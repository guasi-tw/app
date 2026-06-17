// lib/binding/repo.ts
import type { Platform, Visibility } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { BINDING_CODE_TTL_MINUTES } from "./constants";
import { deriveSlug } from "./slug";

/** Create a fresh pending request with a scoped code + TTL (§H.1). */
export function createBindingRequest(params: {
  userId: string;
  platform: Platform;
  code: string;
}) {
  const expiresAt = new Date(Date.now() + BINDING_CODE_TTL_MINUTES * 60_000);
  return prisma.bindingRequest.create({
    data: { userId: params.userId, platform: params.platform, code: params.code, expiresAt },
  });
}

/** Newest live (pending, unexpired) request for this user+platform — reused so the wizard is idempotent. */
export function findActiveRequest(userId: string, platform: Platform) {
  return prisma.bindingRequest.findFirst({
    where: { userId, platform, status: "pending", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

export function findRequestById(id: string) {
  return prisma.bindingRequest.findUnique({ where: { id } });
}

/** The current binding for (正身, platform, account), if any — used to detect a re-validate (§A.6). */
export function findLinkedAccount(userId: string, platform: Platform, accountId: string) {
  return prisma.linkedAccount.findUnique({
    where: { userId_platform_accountId: { userId, platform, accountId } },
  });
}

/** Flip pending → resolved, stamping the platform-resolved author (§H.1). */
export function markResolved(
  id: string,
  resolved: {
    resolvedAccountId: string;
    resolvedHandle: string;
    resolvedDisplayName: string | null;
    proofPostUrl: string;
  },
) {
  return prisma.bindingRequest.update({
    where: { id },
    data: { status: "resolved", ...resolved },
  });
}

/** A real cancel (§D.3 wrong-account / §D.4 取消) — commit nothing. */
export function cancelRequest(id: string) {
  return prisma.bindingRequest.update({ where: { id }, data: { status: "cancelled" } });
}

export function isExpired(req: { expiresAt: Date; status: string }): boolean {
  return req.status === "expired" || req.expiresAt.getTime() <= Date.now();
}

export type CommitResult =
  | { ok: true; linkedAccountId: string; slug: string | null }
  | { ok: false; error: "slug_taken" | "duplicate_binding" | "not_resolvable" };

/**
 * Commit-on-confirm (§H): write LinkedAccount + ProofRecord + bound BindingEvent and mark the
 * request verified — all in ONE transaction. For a provisioning bind (`mintSlug`), also set
 * User.slug (first-claim-wins enforced by the unique index) + force isMain/public.
 */
export async function commitBinding(params: {
  requestId: string;
  asMain: boolean;
  visibility: Visibility;
  mintSlug: boolean; // true only for confirm-as-slug (§D.4)
}): Promise<CommitResult> {
  const req = await findRequestById(params.requestId);
  if (
    !req ||
    req.status !== "resolved" ||
    !req.resolvedAccountId ||
    !req.resolvedHandle ||
    !req.proofPostUrl
  ) {
    return { ok: false, error: "not_resolvable" };
  }

  // The main 分身 is the public face — provisioning forces public (§D.4).
  const visibility: Visibility = params.asMain ? "public" : params.visibility;

  try {
    return await prisma.$transaction(async (tx) => {
      if (params.asMain) {
        await tx.linkedAccount.updateMany({
          where: { userId: req.userId, isMain: true },
          data: { isMain: false },
        });
      }
      const linked = await tx.linkedAccount.create({
        data: {
          userId: req.userId,
          platform: req.platform,
          accountId: req.resolvedAccountId!,
          handle: req.resolvedHandle!,
          displayName: req.resolvedDisplayName,
          status: "verified",
          condition: "active",
          visibility,
          isMain: params.asMain,
        },
      });
      const proof = await tx.proofRecord.create({
        data: {
          linkedAccountId: linked.id,
          proofPostUrl: req.proofPostUrl!,
          authCode: req.code,
          authorHandle: req.resolvedHandle!,
          authorDisplayName: req.resolvedDisplayName,
        },
      });
      await tx.bindingEvent.create({
        data: {
          userId: req.userId,
          platform: req.platform,
          accountId: req.resolvedAccountId!,
          eventType: "bound",
          proofRecordId: proof.id,
        },
      });
      let slug: string | null = null;
      if (params.mintSlug) {
        slug = deriveSlug(req.resolvedHandle!);
        await tx.user.update({ where: { id: req.userId }, data: { slug } });
      }
      await tx.bindingRequest.update({
        where: { id: req.id },
        data: { status: "verified", consumedAt: new Date() },
      });
      return { ok: true as const, linkedAccountId: linked.id, slug };
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Prisma's meta.target is sometimes string[] (["slug"] / ["userId","platform","accountId"]),
    // sometimes a string. String(...) handles both; only the slug index contains "slug", and the
    // user-slug + linked-account uniques are the ONLY two reachable in this tx, so the test is unambiguous.
    const target = String((e as { meta?: { target?: unknown } }).meta?.target ?? "").toLowerCase();
    if (code === "P2002" && target.includes("slug")) return { ok: false, error: "slug_taken" };
    if (code === "P2002") return { ok: false, error: "duplicate_binding" }; // (userId, platform, accountId)
    throw e;
  }
}

export type ProvisionResult =
  | { ok: true; slug: string }
  | { ok: false; error: "slug_taken" | "not_found" };

/**
 * §D.5 setup picker: designate an ALREADY-verified account as 主要帳號 — set isMain + force public +
 * mint the slug from its handle. No new request/proof (the binding already exists).
 */
export async function provisionExistingAccount(
  userId: string,
  linkedAccountId: string,
): Promise<ProvisionResult> {
  const acct = await prisma.linkedAccount.findUnique({ where: { id: linkedAccountId } });
  if (!acct || acct.userId !== userId) return { ok: false, error: "not_found" };
  const slug = deriveSlug(acct.handle);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.linkedAccount.updateMany({
        where: { userId, isMain: true },
        data: { isMain: false },
      });
      await tx.linkedAccount.update({
        where: { id: linkedAccountId },
        data: { isMain: true, visibility: "public" },
      });
      await tx.user.update({ where: { id: userId }, data: { slug } });
    });
    return { ok: true, slug };
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { ok: false, error: "slug_taken" };
    throw e;
  }
}

/** Eligible existing main-account candidates for the §D.5 picker (verified, slug-eligible platforms). */
export function listProvisionCandidates(userId: string) {
  return prisma.linkedAccount.findMany({
    where: { userId, status: "verified", platform: "threads" }, // Slice 2: only Threads is slug-eligible
    orderBy: { verifiedAt: "asc" },
  });
}
