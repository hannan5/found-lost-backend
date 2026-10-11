// Copied from ../Lost-FInd/src/data/found-items.ts and admin-mock.ts.
// Keep the strings identical to the frontend; the seed maps them to Prisma enums.

export type CategoryLabel =
  "Electronics" | "Bags & wallets" | "Clothing" | "Accessories" | "Keys" | "Documents" | "Other";
export type ItemStatusLabel = "Waiting for owner" | "Reunited";
export type ReviewStatusLabel = "Pending review" | "Approved" | "Rejected" | "Returned";
export type ClaimStatusLabel = "Pending" | "Approved" | "Rejected";

export interface SeedFoundItem {
  /** Frontend mock id, stored in FoundItem.slug */
  slug: string;
  name: string;
  category: CategoryLabel;
  description: string;
  location: string;
  foundDate: string;
  image: string;
  status: ItemStatusLabel;
  submittedAt: string;
  reviewStatus: ReviewStatusLabel;
  reporter: { name: string; email: string; phone: string };
}

export interface SeedClaim {
  /** Frontend mock id, stored as Claim.id */
  id: string;
  itemSlug: string;
  claimant: { name: string; email: string; phone: string };
  lostItemDescription: string;
  ownershipProof: string;
  submittedAt: string;
  status: ClaimStatusLabel;
}

export const seedFoundItems: SeedFoundItem[] = [
  {
    slug: "silver-watch",
    name: "Silver wristwatch",
    category: "Accessories",
    description:
      "A silver-tone wristwatch with a dark blue face and a metal link band. It was turned in safely and is being kept with the venue's lost property team.",
    location: "Riverside Park, near the east entrance",
    foundDate: "2026-10-08",
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1100&q=85",
    status: "Waiting for owner",
    submittedAt: "2026-10-08",
    reviewStatus: "Approved",
    reporter: { name: "Morgan Ellis", email: "morgan@example.com", phone: "+1 202-555-0101" },
  },
  {
    slug: "canvas-backpack",
    name: "Olive canvas backpack",
    category: "Bags & wallets",
    description:
      "A well-kept olive canvas daypack with leather-look trim. Found on a bench after the afternoon market and handed to the information desk.",
    location: "Old Town Market, information desk",
    foundDate: "2026-10-07",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1100&q=85",
    status: "Waiting for owner",
    submittedAt: "2026-10-07",
    reviewStatus: "Approved",
    reporter: { name: "Jamie Brooks", email: "jamie@example.com", phone: "+1 202-555-0102" },
  },
  {
    slug: "wireless-headphones",
    name: "Wireless headphones",
    category: "Electronics",
    description:
      "Over-ear wireless headphones in a matte charcoal finish. They were left in the quiet seating area and are now in secure care.",
    location: "Central Library, second floor",
    foundDate: "2026-10-06",
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1100&q=85",
    status: "Waiting for owner",
    submittedAt: "2026-10-06",
    reviewStatus: "Approved",
    reporter: { name: "Taylor Morgan", email: "taylor@example.com", phone: "+1 202-555-0103" },
  },
  {
    slug: "black-sunglasses",
    name: "Black frame sunglasses",
    category: "Accessories",
    description:
      "Classic black frame sunglasses with dark lenses. Found near the garden path; identifying details are being kept private for verification.",
    location: "Botanical Gardens, north path",
    foundDate: "2026-10-05",
    image:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1100&q=85",
    status: "Waiting for owner",
    submittedAt: "2026-10-05",
    reviewStatus: "Approved",
    reporter: { name: "Riley Parker", email: "riley@example.com", phone: "+1 202-555-0104" },
  },
  {
    slug: "blue-sneakers",
    name: "Blue running shoes",
    category: "Clothing",
    description:
      "A pair of blue running shoes in a small drawstring bag. Left at the changing area and brought to the community centre reception.",
    location: "Harborview Sports Centre",
    foundDate: "2026-10-04",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1100&q=85",
    status: "Waiting for owner",
    submittedAt: "2026-10-04",
    reviewStatus: "Approved",
    reporter: { name: "Casey Lane", email: "casey@example.com", phone: "+1 202-555-0105" },
  },
  {
    slug: "leather-wallet",
    name: "Brown leather wallet",
    category: "Bags & wallets",
    description:
      "A slim brown leather wallet. For the owner's privacy, contents and identifying marks are not shown here. Please include those details in a claim.",
    location: "Maple Street Café",
    foundDate: "2026-10-03",
    image:
      "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1100&q=85",
    status: "Reunited",
    submittedAt: "2026-10-03",
    reviewStatus: "Returned",
    reporter: { name: "Alex Rivera", email: "alex@example.com", phone: "+1 202-555-0106" },
  },
  {
    slug: "camera",
    name: "Compact digital camera",
    category: "Electronics",
    description:
      "A compact black digital camera found in the gallery courtyard. The memory card and any identifying details remain private.",
    location: "City Art Gallery, courtyard",
    foundDate: "2026-10-02",
    image:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1100&q=85",
    status: "Waiting for owner",
    submittedAt: "2026-10-02",
    reviewStatus: "Approved",
    reporter: { name: "Jordan Lee", email: "jordan@example.com", phone: "+1 202-555-0107" },
  },
  {
    slug: "keyring",
    name: "Brass keyring with two keys",
    category: "Keys",
    description:
      "A small brass keyring with two keys and a plain green tag. Found near the main walkway and secured by the park office.",
    location: "Willow Creek Trail, main walkway",
    foundDate: "2026-10-01",
    image:
      "https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=1100&q=85",
    status: "Waiting for owner",
    submittedAt: "2026-10-01",
    reviewStatus: "Approved",
    reporter: { name: "Sam Ellis", email: "sam@example.com", phone: "+1 202-555-0108" },
  },
  {
    slug: "cream-scarf",
    name: "Cream knit scarf",
    category: "Clothing",
    description:
      "A soft cream-coloured knit scarf, found folded beside the outdoor seating area. It has been handed in to the café team.",
    location: "Juniper Coffee, patio",
    foundDate: "2026-09-29",
    image:
      "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1100&q=85",
    status: "Waiting for owner",
    submittedAt: "2026-09-29",
    reviewStatus: "Approved",
    reporter: { name: "Avery Reed", email: "avery@example.com", phone: "+1 202-555-0109" },
  },
  {
    slug: "fringed-scarf-review",
    name: "Cream scarf with fringe",
    category: "Clothing",
    description:
      "A cream-coloured knit scarf found beside the transit shelter and handed in for review.",
    location: "Juniper Avenue transit shelter",
    foundDate: "2026-10-10",
    image:
      "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=1100&q=85",
    status: "Waiting for owner",
    submittedAt: "2026-10-10",
    reviewStatus: "Pending review",
    reporter: { name: "Chris Taylor", email: "chris@example.com", phone: "+1 202-555-0110" },
  },
  {
    slug: "canvas-tote-review",
    name: "Canvas tote bag",
    category: "Bags & wallets",
    description:
      "A canvas tote bag with a small stitched front pocket, found near the north entrance.",
    location: "Northside Community Hall",
    foundDate: "2026-09-27",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1100&q=85",
    status: "Waiting for owner",
    submittedAt: "2026-09-27",
    reviewStatus: "Rejected",
    reporter: { name: "Drew Morgan", email: "drew@example.com", phone: "+1 202-555-0111" },
  },
];

export const seedClaims: SeedClaim[] = [
  {
    id: "claim-watch-01",
    itemSlug: "silver-watch",
    claimant: { name: "Robin Harper", email: "robin@example.com", phone: "+1 202-555-0121" },
    lostItemDescription: "A silver watch with a navy dial and a small scratch near the clasp.",
    ownershipProof:
      "The initials R.H. are engraved on the inside of the clasp; there is also a tiny star mark by the 6.",
    submittedAt: "2026-10-09",
    status: "Pending",
  },
  {
    id: "claim-bag-02",
    itemSlug: "canvas-backpack",
    claimant: { name: "Devon Price", email: "devon@example.com", phone: "+1 202-555-0122" },
    lostItemDescription: "An olive canvas backpack with a small notebook in the front pocket.",
    ownershipProof:
      "The left strap has a hand-stitched repair in dark green thread, and a brass compass is clipped inside.",
    submittedAt: "2026-10-08",
    status: "Pending",
  },
  {
    id: "claim-keys-03",
    itemSlug: "keyring",
    claimant: { name: "Emery Clark", email: "emery@example.com", phone: "+1 202-555-0123" },
    lostItemDescription: "Two keys on a brass ring with a plain green tag.",
    ownershipProof:
      "One key has three shallow notches along its side. The tag has a handwritten number on the back.",
    submittedAt: "2026-10-06",
    status: "Approved",
  },
  {
    id: "claim-camera-04",
    itemSlug: "camera",
    claimant: { name: "Skyler Quinn", email: "skyler@example.com", phone: "+1 202-555-0124" },
    lostItemDescription: "A compact camera with a black case.",
    ownershipProof: "I can share the serial number and describe the strap attached to the case.",
    submittedAt: "2026-10-04",
    status: "Rejected",
  },
];
