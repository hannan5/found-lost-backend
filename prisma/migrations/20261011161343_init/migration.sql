-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('ELECTRONICS', 'BAGS_WALLETS', 'CLOTHING', 'ACCESSORIES', 'KEYS', 'DOCUMENTS', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('WAITING_FOR_OWNER', 'REUNITED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoundItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "foundDate" TEXT NOT NULL,
    "image" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'WAITING_FOR_OWNER',
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "submittedAt" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "reporterEmail" TEXT NOT NULL,
    "reporterPhone" TEXT NOT NULL,
    "reporterWhatsapp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoundItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "claimantName" TEXT NOT NULL,
    "claimantEmail" TEXT NOT NULL,
    "claimantPhone" TEXT NOT NULL,
    "lostItemDescription" TEXT NOT NULL,
    "ownershipProof" TEXT NOT NULL,
    "supportingImage" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LostItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "reportedDate" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "reporterEmail" TEXT NOT NULL,
    "reporterPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LostItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FoundItem_slug_key" ON "FoundItem"("slug");

-- CreateIndex
CREATE INDEX "FoundItem_reviewStatus_submittedAt_idx" ON "FoundItem"("reviewStatus", "submittedAt");

-- CreateIndex
CREATE INDEX "FoundItem_category_idx" ON "FoundItem"("category");

-- CreateIndex
CREATE INDEX "Claim_itemId_status_idx" ON "Claim"("itemId", "status");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FoundItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
