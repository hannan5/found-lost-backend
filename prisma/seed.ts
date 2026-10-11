import "dotenv/config";
import {
  PrismaClient,
  type ClaimStatus,
  type ItemCategory,
  type ItemStatus,
  type ReviewStatus,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import {
  seedClaims,
  seedFoundItems,
  type CategoryLabel,
  type ClaimStatusLabel,
  type ItemStatusLabel,
  type ReviewStatusLabel,
} from "./seed-data";

// Label -> enum maps. Mirrors src/common/lib/mappers.ts (kept separate so the
// seed does not depend on the Nest build output).
const categoryByLabel: Record<CategoryLabel, ItemCategory> = {
  Electronics: "ELECTRONICS",
  "Bags & wallets": "BAGS_WALLETS",
  Clothing: "CLOTHING",
  Accessories: "ACCESSORIES",
  Keys: "KEYS",
  Documents: "DOCUMENTS",
  Other: "OTHER",
};
const itemStatusByLabel: Record<ItemStatusLabel, ItemStatus> = {
  "Waiting for owner": "WAITING_FOR_OWNER",
  Reunited: "REUNITED",
};
const reviewStatusByLabel: Record<ReviewStatusLabel, ReviewStatus> = {
  "Pending review": "PENDING_REVIEW",
  Approved: "APPROVED",
  Rejected: "REJECTED",
  Returned: "RETURNED",
};
const claimStatusByLabel: Record<ClaimStatusLabel, ClaimStatus> = {
  Pending: "PENDING",
  Approved: "APPROVED",
  Rejected: "REJECTED",
};

export interface SeedOptions {
  adminEmail: string;
  adminPassword: string;
  log?: (line: string) => void;
}

export interface SeedResult {
  adminId: string;
  /** frontend slug -> database id */
  itemIdBySlug: Map<string, string>;
  claimIds: string[];
}

/**
 * Idempotent: upserts the admin by email, items by slug and claims by their
 * frontend id. Used by `npm run db:seed` and by the DB-backed e2e tests.
 */
export async function seed(prisma: PrismaClient, options: SeedOptions): Promise<SeedResult> {
  const log = options.log ?? (() => undefined);
  if (options.adminPassword.length < 8) {
    throw new Error("Admin password must be at least 8 characters.");
  }

  const email = options.adminEmail.toLowerCase();
  const passwordHash = await bcrypt.hash(options.adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { name: "LostNFind Admin", email, passwordHash, role: "ADMIN" },
  });
  log(`admin  ${admin.email}`);

  const itemIdBySlug = new Map<string, string>();
  for (const item of seedFoundItems) {
    const data = {
      name: item.name,
      category: categoryByLabel[item.category],
      description: item.description,
      location: item.location,
      foundDate: item.foundDate,
      image: item.image,
      status: itemStatusByLabel[item.status],
      reviewStatus: reviewStatusByLabel[item.reviewStatus],
      submittedAt: item.submittedAt,
      reporterName: item.reporter.name,
      reporterEmail: item.reporter.email,
      reporterPhone: item.reporter.phone,
    };
    const saved = await prisma.foundItem.upsert({
      where: { slug: item.slug },
      update: data,
      create: { slug: item.slug, ...data },
    });
    itemIdBySlug.set(item.slug, saved.id);
  }
  log(`items  ${itemIdBySlug.size}`);

  const claimIds: string[] = [];
  for (const claim of seedClaims) {
    const itemId = itemIdBySlug.get(claim.itemSlug);
    if (!itemId) {
      throw new Error(`Seed claim ${claim.id} references unknown item ${claim.itemSlug}`);
    }
    const data = {
      itemId,
      claimantName: claim.claimant.name,
      claimantEmail: claim.claimant.email,
      claimantPhone: claim.claimant.phone,
      lostItemDescription: claim.lostItemDescription,
      ownershipProof: claim.ownershipProof,
      status: claimStatusByLabel[claim.status],
      submittedAt: claim.submittedAt,
    };
    const saved = await prisma.claim.upsert({
      where: { id: claim.id },
      update: data,
      create: { id: claim.id, ...data },
    });
    claimIds.push(saved.id);
  }
  log(`claims ${claimIds.length}`);

  return { adminId: admin.id, itemIdBySlug, claimIds };
}

async function main(): Promise<void> {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD must be set (8+ characters) before seeding.");
  }
  const prisma = new PrismaClient();
  try {
    await seed(prisma, {
      adminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@lostnfind.local",
      adminPassword,
      log: (line) => console.log(line),
    });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
