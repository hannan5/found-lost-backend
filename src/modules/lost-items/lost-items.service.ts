import { Injectable } from "@nestjs/common";
import { type LostItem } from "@prisma/client";
import { type CategoryLabel, categoryFromLabel, categoryToLabel } from "../../common/lib/mappers";
import { PrismaService } from "../../prisma/prisma.service";
import { type CreateLostItemInput } from "./lost-items.schemas";

/** What the public gets back after reporting a lost item. No reporter fields. */
export interface LostItemSummary {
  id: string;
  name: string;
  category: CategoryLabel;
  location: string;
  reportedDate: string;
}

function toLostItemSummary(item: LostItem): LostItemSummary {
  return {
    id: item.id,
    name: item.name,
    category: categoryToLabel[item.category],
    location: item.location,
    reportedDate: item.reportedDate,
  };
}

/**
 * Lost-item reports. No UI yet; kept so the "I lost something" flow and the
 * matching feature (POST /api/match) can be added later.
 */
@Injectable()
export class LostItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateLostItemInput): Promise<LostItemSummary> {
    const item = await this.prisma.lostItem.create({
      data: {
        name: input.name,
        category: categoryFromLabel[input.category],
        description: input.description,
        location: input.location,
        reportedDate: input.reportedDate,
        reporterName: input.reporterName,
        reporterEmail: input.email.toLowerCase(),
        reporterPhone: input.phone,
      },
    });
    return toLostItemSummary(item);
  }
}
