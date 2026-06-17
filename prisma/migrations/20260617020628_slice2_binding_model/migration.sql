-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('threads', 'instagram', 'miin');

-- CreateEnum
CREATE TYPE "BindingRequestStatus" AS ENUM ('pending', 'resolved', 'verified', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "LinkedAccountStatus" AS ENUM ('verified', 'unbound');

-- CreateEnum
CREATE TYPE "AccountCondition" AS ENUM ('active', 'banned', 'hacked');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "BindingEventType" AS ENUM ('bound', 'unbound', 'reported_banned', 'reported_hacked', 're_verified');

-- CreateTable
CREATE TABLE "BindingRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "code" TEXT NOT NULL,
    "status" "BindingRequestStatus" NOT NULL DEFAULT 'pending',
    "resolvedAccountId" TEXT,
    "resolvedHandle" TEXT,
    "resolvedDisplayName" TEXT,
    "proofPostUrl" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BindingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "accountId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "LinkedAccountStatus" NOT NULL DEFAULT 'verified',
    "condition" "AccountCondition" NOT NULL DEFAULT 'active',
    "visibility" "Visibility" NOT NULL DEFAULT 'private',
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofRecord" (
    "id" TEXT NOT NULL,
    "linkedAccountId" TEXT NOT NULL,
    "proofPostUrl" TEXT NOT NULL,
    "authCode" TEXT NOT NULL,
    "authorHandle" TEXT NOT NULL,
    "authorDisplayName" TEXT,
    "snapshotContent" TEXT,
    "snapshotImage" TEXT,
    "archiveUrl" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BindingEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "accountId" TEXT NOT NULL,
    "eventType" "BindingEventType" NOT NULL,
    "reason" TEXT,
    "proofRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BindingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BindingRequest_userId_platform_status_idx" ON "BindingRequest"("userId", "platform", "status");

-- CreateIndex
CREATE INDEX "LinkedAccount_platform_accountId_idx" ON "LinkedAccount"("platform", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedAccount_userId_platform_accountId_key" ON "LinkedAccount"("userId", "platform", "accountId");

-- CreateIndex
CREATE INDEX "BindingEvent_userId_createdAt_idx" ON "BindingEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "BindingRequest" ADD CONSTRAINT "BindingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofRecord" ADD CONSTRAINT "ProofRecord_linkedAccountId_fkey" FOREIGN KEY ("linkedAccountId") REFERENCES "LinkedAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BindingEvent" ADD CONSTRAINT "BindingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
