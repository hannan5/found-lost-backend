import { Injectable } from "@nestjs/common";
import {
  type AdminClaim,
  type AdminItem,
  toAdminClaim,
  toAdminItem,
} from "../../common/lib/mappers";
import { PrismaService } from "../../prisma/prisma.service";

/** Feeds the frontend AdminOverview tiles and the two "recent" tables. */
export interface AdminStats {
  totalItems: number;
  pendingClaims: number;
  approvedClaims: number;
  itemsReturned: number;
  recentItems: AdminItem[];
  recentClaims: AdminClaim[];
}

const RECENT_LIMIT = 4;

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(): Promise<AdminStats> {
    const [totalItems, pendingClaims, approvedClaims, itemsReturned, recentItems, recentClaims] =
      await this.prisma.$transaction([
        this.prisma.foundItem.count(),
        this.prisma.claim.count({ where: { status: "PENDING" } }),
        this.prisma.claim.count({ where: { status: "APPROVED" } }),
        this.prisma.foundItem.count({ where: { reviewStatus: "RETURNED" } }),
        this.prisma.foundItem.findMany({
          orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
          take: RECENT_LIMIT,
        }),
        this.prisma.claim.findMany({
          include: { item: true },
          orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
          take: RECENT_LIMIT,
        }),
      ]);

    return {
      totalItems,
      pendingClaims,
      approvedClaims,
      itemsReturned,
      recentItems: recentItems.map(toAdminItem),
      recentClaims: recentClaims.map(toAdminClaim),
    };
  }
}
