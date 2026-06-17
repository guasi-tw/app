-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BindingEventType" ADD VALUE 'disclosed';
ALTER TYPE "BindingEventType" ADD VALUE 'set_main';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3);

-- Backfill: existing users have already onboarded — stamp onboardedAt so they
-- skip the first-time wizard once Release 2's routing goes live (§M).
UPDATE "User" SET "onboardedAt" = "createdAt" WHERE "onboardedAt" IS NULL;
