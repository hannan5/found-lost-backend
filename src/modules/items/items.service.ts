import { Injectable } from "@nestjs/common";
import { type FoundItem, type ItemCategory, type Prisma, type ReviewStatus } from "@prisma/client";
import { AppException } from "../../common/errors/app.exception";
import { itemReturned } from "../../common/lib/emails";
import { todayUtc } from "../../common/lib/format";
import {
  type AdminItem,
  categoryFromLabel,
  categoryToLabel,
  type PublicItem,
  reviewStatusFromLabel,
  toAdminItem,
  toPublicItem,
} from "../../common/lib/mappers";
import { type UploadedImage } from "../../common/pipes/image-file.pipe";
import { StorageService } from "../../integrations/storage/storage.service";
import { MailerService } from "../../integrations/mailer/mailer.service";
import { PrismaService } from "../../prisma/prisma.service";
import { canTransitionReview, reviewTransitionError } from "./item-transitions";
import {
  type AdminListItemsQuery,
  type CreateItemInput,
  type ListItemsQuery,
  type UpdateReviewStatusInput,
} from "./items.schemas";

export interface ListResult<T> {
  data: T[];
  total: number;
}

/** What the public may see. Everything else is invisible, not just hidden. */
const PUBLIC_REVIEW_STATUSES: readonly ReviewStatus[] = ["APPROVED", "RETURNED"];

/** Categories whose frontend label contains `q`, so "bags" also matches "Bags & wallets". */
function categoriesMatching(q: string): ItemCategory[] {
  const needle = q.toLowerCase();
  return (Object.keys(categoryToLabel) as ItemCategory[]).filter((category) =>
    categoryToLabel[category].toLowerCase().includes(needle),
  );
}

/** Accept either the database id or the seeded frontend slug ("silver-watch"). */
function byIdOrSlug(idOrSlug: string): Prisma.FoundItemWhereInput {
  return { OR: [{ id: idOrSlug }, { slug: idOrSlug }] };
}

/**
 * Business rules for found items. Prisma calls for FoundItem live only here.
 */
@Injectable()
export class ItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mailer: MailerService,
  ) {}

  // ----- shared lookups (used by ClaimsService too) -------------------------

  findByIdOrSlug(idOrSlug: string): Promise<FoundItem | null> {
    return this.prisma.foundItem.findFirst({ where: byIdOrSlug(idOrSlug) });
  }

  // ----- public -----------------------------------------------------------

  async listPublic(query: ListItemsQuery): Promise<ListResult<PublicItem>> {
    const where: Prisma.FoundItemWhereInput = {
      reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] },
    };
    if (query.category) where.category = categoryFromLabel[query.category];
    if (query.q) {
      const contains = { contains: query.q, mode: "insensitive" as const };
      const matchingCategories = categoriesMatching(query.q);
      where.OR = [
        { name: contains },
        { location: contains },
        { description: contains },
        ...(matchingCategories.length ? [{ category: { in: matchingCategories } }] : []),
      ];
    }

    const orderBy: Prisma.FoundItemOrderByWithRelationInput[] =
      query.sort === "name"
        ? [{ name: "asc" }, { createdAt: "desc" }]
        : query.sort === "oldest"
          ? [{ foundDate: "asc" }, { createdAt: "asc" }]
          : [{ foundDate: "desc" }, { createdAt: "desc" }];

    const [items, total] = await this.prisma.$transaction([
      this.prisma.foundItem.findMany({ where, orderBy, take: query.limit }),
      this.prisma.foundItem.count({ where }),
    ]);
    return { data: items.map(toPublicItem), total };
  }

  async getPublic(idOrSlug: string): Promise<PublicItem> {
    const item = await this.prisma.foundItem.findFirst({
      where: { AND: [byIdOrSlug(idOrSlug), { reviewStatus: { in: [...PUBLIC_REVIEW_STATUSES] } }] },
    });
    if (!item) throw AppException.notFound("This item is not available.");
    return toPublicItem(item);
  }

  async create(input: CreateItemInput, image?: UploadedImage): Promise<PublicItem> {
    const imageUrl = image ? await this.storage.uploadImage(image, "items") : null;
    const item = await this.prisma.foundItem.create({
      data: {
        name: input.name,
        category: categoryFromLabel[input.category],
        description: input.description,
        location: input.location,
        foundDate: input.foundDate,
        image: imageUrl,
        status: "WAITING_FOR_OWNER",
        reviewStatus: "PENDING_REVIEW",
        submittedAt: todayUtc(),
        reporterName: input.reporterName,
        reporterEmail: input.email.toLowerCase(),
        reporterPhone: input.phone,
        reporterWhatsapp: input.whatsapp ?? null,
      },
    });
    return toPublicItem(item);
  }

  // ----- admin ------------------------------------------------------------

  async listAdmin(query: AdminListItemsQuery): Promise<ListResult<AdminItem>> {
    const where: Prisma.FoundItemWhereInput = {};
    if (query.category) where.category = categoryFromLabel[query.category];
    if (query.reviewStatus) where.reviewStatus = reviewStatusFromLabel[query.reviewStatus];
    if (query.q) {
      const contains = { contains: query.q, mode: "insensitive" as const };
      const matchingCategories = categoriesMatching(query.q);
      where.OR = [
        { name: contains },
        { location: contains },
        { reporterName: contains },
        ...(matchingCategories.length ? [{ category: { in: matchingCategories } }] : []),
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.foundItem.findMany({
        where,
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.foundItem.count({ where }),
    ]);
    return { data: items.map(toAdminItem), total };
  }

  async getAdmin(idOrSlug: string): Promise<AdminItem> {
    const item = await this.findByIdOrSlug(idOrSlug);
    if (!item) throw AppException.notFound("This report could not be found.");
    return toAdminItem(item);
  }

  async updateReviewStatus(idOrSlug: string, input: UpdateReviewStatusInput): Promise<AdminItem> {
    const item = await this.findByIdOrSlug(idOrSlug);
    if (!item) throw AppException.notFound("This report could not be found.");

    const target = reviewStatusFromLabel[input.reviewStatus];
    if (!canTransitionReview(item.reviewStatus, target)) {
      throw AppException.conflict(reviewTransitionError(item.reviewStatus, target));
    }

    const updated = await this.prisma.foundItem.update({
      where: { id: item.id },
      data: { reviewStatus: target },
    });
    return toAdminItem(updated);
  }

  /**
   * APPROVED -> RETURNED, also sets status = REUNITED and rejects any still-pending
   * claims on the item. Emails the approved claimant if there is one.
   */
  async markReturned(idOrSlug: string): Promise<AdminItem> {
    const item = await this.findByIdOrSlug(idOrSlug);
    if (!item) throw AppException.notFound("This report could not be found.");
    if (item.reviewStatus === "RETURNED") {
      throw AppException.conflict("This item has already been marked as returned.");
    }
    if (item.reviewStatus !== "APPROVED") {
      throw AppException.conflict("Only approved items can be marked as returned.");
    }

    const [updated, approvedClaim] = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.foundItem.update({
        where: { id: item.id },
        data: { reviewStatus: "RETURNED", status: "REUNITED" },
      });
      const claim = await tx.claim.findFirst({
        where: { itemId: item.id, status: "APPROVED" },
        orderBy: { updatedAt: "desc" },
      });
      // Nobody else can claim a returned item: close the remaining pending claims.
      await tx.claim.updateMany({
        where: { itemId: item.id, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      return [saved, claim] as const;
    });

    if (approvedClaim) await this.mailer.send(itemReturned(updated, approvedClaim));
    return toAdminItem(updated);
  }
}
