import {
  type Claim,
  type ClaimStatus,
  type FoundItem,
  type ItemCategory,
  type ItemStatus,
  type ReviewStatus,
  type User,
} from "@prisma/client";
import { type AuthUser } from "../types/auth";

// ---------------------------------------------------------------------------
// Frontend strings (mirror of ../Lost-FInd/src/types/item.ts). Never send the
// Prisma enum identifiers to the frontend.
// ---------------------------------------------------------------------------

export const categoryLabels = [
  "Electronics",
  "Bags & wallets",
  "Clothing",
  "Accessories",
  "Keys",
  "Documents",
  "Other",
] as const;
export type CategoryLabel = (typeof categoryLabels)[number];

export const itemStatusLabels = ["Waiting for owner", "Reunited"] as const;
export type ItemStatusLabel = (typeof itemStatusLabels)[number];

export const reviewStatusLabels = ["Pending review", "Approved", "Rejected", "Returned"] as const;
export type ReviewStatusLabel = (typeof reviewStatusLabels)[number];

export const claimStatusLabels = ["Pending", "Approved", "Rejected"] as const;
export type ClaimStatusLabel = (typeof claimStatusLabels)[number];

// enum -> label
export const categoryToLabel: Record<ItemCategory, CategoryLabel> = {
  ELECTRONICS: "Electronics",
  BAGS_WALLETS: "Bags & wallets",
  CLOTHING: "Clothing",
  ACCESSORIES: "Accessories",
  KEYS: "Keys",
  DOCUMENTS: "Documents",
  OTHER: "Other",
};
export const itemStatusToLabel: Record<ItemStatus, ItemStatusLabel> = {
  WAITING_FOR_OWNER: "Waiting for owner",
  REUNITED: "Reunited",
};
export const reviewStatusToLabel: Record<ReviewStatus, ReviewStatusLabel> = {
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RETURNED: "Returned",
};
export const claimStatusToLabel: Record<ClaimStatus, ClaimStatusLabel> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function invert<K extends string, V extends string>(record: Record<K, V>): Record<V, K> {
  const out = {} as Record<V, K>;
  for (const key of Object.keys(record) as K[]) out[record[key]] = key;
  return out;
}

// label -> enum (use after Zod has validated the label)
export const categoryFromLabel = invert(categoryToLabel);
export const itemStatusFromLabel = invert(itemStatusToLabel);
export const reviewStatusFromLabel = invert(reviewStatusToLabel);
export const claimStatusFromLabel = invert(claimStatusToLabel);

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

/** Exactly the frontend `FoundItem` type. No reporter fields, no reviewStatus. */
export interface PublicItem {
  id: string;
  name: string;
  category: CategoryLabel;
  description: string;
  location: string;
  foundDate: string;
  image: string | null;
  status: ItemStatusLabel;
}

export interface ReporterContact {
  name: string;
  email: string;
  phone: string;
  whatsapp?: string;
}

/** The frontend `AdminFoundItem` type. */
export interface AdminItem extends PublicItem {
  submittedAt: string;
  reviewStatus: ReviewStatusLabel;
  reporter: ReporterContact;
}

export interface AdminClaim {
  id: string;
  itemId: string;
  claimant: { name: string; email: string; phone: string };
  lostItemDescription: string;
  ownershipProof: string;
  supportingImage?: string;
  submittedAt: string;
  status: ClaimStatusLabel;
  item: {
    id: string;
    name: string;
    category: CategoryLabel;
    location: string;
    image: string | null;
    reviewStatus: ReviewStatusLabel;
  };
}

// ---------------------------------------------------------------------------
// Mappers. Public routes must use toPublicItem() and nothing else.
// ---------------------------------------------------------------------------

export function toPublicItem(item: FoundItem): PublicItem {
  return {
    id: item.id,
    name: item.name,
    category: categoryToLabel[item.category],
    description: item.description,
    location: item.location,
    foundDate: item.foundDate,
    image: item.image,
    status: itemStatusToLabel[item.status],
  };
}

export function toAdminItem(item: FoundItem): AdminItem {
  const reporter: ReporterContact = {
    name: item.reporterName,
    email: item.reporterEmail,
    phone: item.reporterPhone,
  };
  if (item.reporterWhatsapp) reporter.whatsapp = item.reporterWhatsapp;

  return {
    ...toPublicItem(item),
    submittedAt: item.submittedAt,
    reviewStatus: reviewStatusToLabel[item.reviewStatus],
    reporter,
  };
}

export function toAdminClaim(claim: Claim & { item: FoundItem }): AdminClaim {
  const mapped: AdminClaim = {
    id: claim.id,
    itemId: claim.itemId,
    claimant: {
      name: claim.claimantName,
      email: claim.claimantEmail,
      phone: claim.claimantPhone,
    },
    lostItemDescription: claim.lostItemDescription,
    ownershipProof: claim.ownershipProof,
    submittedAt: claim.submittedAt,
    status: claimStatusToLabel[claim.status],
    item: {
      id: claim.item.id,
      name: claim.item.name,
      category: categoryToLabel[claim.item.category],
      location: claim.item.location,
      image: claim.item.image,
      reviewStatus: reviewStatusToLabel[claim.item.reviewStatus],
    },
  };
  if (claim.supportingImage) mapped.supportingImage = claim.supportingImage;
  return mapped;
}

export function toAuthUser(user: User): AuthUser & { name: string } {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
