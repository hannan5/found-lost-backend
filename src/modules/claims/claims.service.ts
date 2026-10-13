import { Injectable } from "@nestjs/common";
import { type Claim, type FoundItem, type Prisma } from "@prisma/client";
import { AppException } from "../../common/errors/app.exception";
import {
  claimApproved,
  claimApprovedForReporter,
  claimRejected,
  newClaimForAdmin,
} from "../../common/lib/emails";
import { todayUtc } from "../../common/lib/format";
import {
  type AdminClaim,
  claimStatusFromLabel,
  type ClaimStatusLabel,
  claimStatusToLabel,
  toAdminClaim,
} from "../../common/lib/mappers";
import { type UploadedImage } from "../../common/pipes/image-file.pipe";
import { StorageService } from "../../integrations/storage/storage.service";
import { MailerService } from "../../integrations/mailer/mailer.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ItemsService, type ListResult } from "../items/items.service";
import {
  type AdminListClaimsQuery,
  type CreateClaimInput,
  type UpdateClaimStatusInput,
} from "./claims.schemas";

export interface CreatedClaim {
  id: string;
  status: ClaimStatusLabel;
}

type ClaimWithItem = Claim & { item: FoundItem };

/**
 * Business rules for claims. Prisma calls for Claim live only here (plus the
 * read in ItemsService.markReturned).
 */
@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemsService,
    private readonly storage: StorageService,
    private readonly mailer: MailerService,
  ) {}

  // ----- public -----------------------------------------------------------

  /** Item must be APPROVED and WAITING_FOR_OWNER. Non-public items 404 so nothing leaks. */
  async create(
    itemIdOrSlug: string,
    input: CreateClaimInput,
    supportingImage?: UploadedImage,
  ): Promise<CreatedClaim> {
    const item = await this.items.findByIdOrSlug(itemIdOrSlug);
    if (!item || (item.reviewStatus !== "APPROVED" && item.reviewStatus !== "RETURNED")) {
      throw AppException.notFound("This item is not available.");
    }
    if (item.reviewStatus === "RETURNED" || item.status === "REUNITED") {
      throw AppException.conflict("This item has already been reunited with its owner.");
    }

    const imageUrl = supportingImage
      ? await this.storage.uploadImage(supportingImage, "claims")
      : null;

    const claim = await this.prisma.claim.create({
      data: {
        itemId: item.id,
        claimantName: input.name,
        claimantEmail: input.email.toLowerCase(),
        claimantPhone: input.phone,
        lostItemDescription: input.description,
        ownershipProof: input.proof,
        supportingImage: imageUrl,
        status: "PENDING",
        submittedAt: todayUtc(),
      },
    });

    await this.mailer.send(newClaimForAdmin(this.mailer.adminEmail, item, claim));
    return { id: claim.id, status: claimStatusToLabel[claim.status] };
  }

  // ----- admin ------------------------------------------------------------

  async listAdmin(query: AdminListClaimsQuery): Promise<ListResult<AdminClaim>> {
    const where: Prisma.ClaimWhereInput = {};
    if (query.status) where.status = claimStatusFromLabel[query.status];
    if (query.q) {
      const contains = { contains: query.q, mode: "insensitive" as const };
      where.OR = [
        { claimantName: contains },
        { claimantEmail: contains },
        { item: { name: contains } },
        { item: { location: contains } },
      ];
    }

    const [claims, total] = await this.prisma.$transaction([
      this.prisma.claim.findMany({
        where,
        include: { item: true },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.claim.count({ where }),
    ]);
    return { data: claims.map(toAdminClaim), total };
  }

  async getAdmin(id: string): Promise<AdminClaim> {
    const claim = await this.findWithItem(id);
    if (!claim) throw AppException.notFound("This claim could not be found.");
    return toAdminClaim(claim);
  }

  /**
   * PENDING -> APPROVED | REJECTED. Approving rejects every other pending claim on
   * the same item in the same transaction, then the claimant is emailed.
   */
  async updateStatus(id: string, input: UpdateClaimStatusInput): Promise<AdminClaim> {
    const claim = await this.findWithItem(id);
    if (!claim) throw AppException.notFound("This claim could not be found.");
    if (claim.status !== "PENDING") {
      throw AppException.conflict("This claim has already been reviewed.");
    }
    if (claim.item.reviewStatus === "RETURNED") {
      throw AppException.conflict(
        "This item has already been returned, so its claims can no longer change.",
      );
    }

    const target = claimStatusFromLabel[input.status];
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.claim.update({
        where: { id: claim.id },
        data: { status: target },
        include: { item: true },
      });
      if (target === "APPROVED") {
        await tx.claim.updateMany({
          where: { itemId: claim.itemId, status: "PENDING", id: { not: claim.id } },
          data: { status: "REJECTED" },
        });
      }
      return saved;
    });

    if (target === "APPROVED") {
      // Both sides get each other's contact so they can arrange the handover directly.
      await this.mailer.send(claimApproved(updated.item, updated));
      await this.mailer.send(claimApprovedForReporter(updated.item, updated));
    } else {
      await this.mailer.send(claimRejected(updated.item, updated));
    }

    return toAdminClaim(updated);
  }

  private findWithItem(id: string): Promise<ClaimWithItem | null> {
    return this.prisma.claim.findUnique({ where: { id }, include: { item: true } });
  }
}
