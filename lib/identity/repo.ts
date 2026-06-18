import { prisma } from "@/lib/db/client";
import type { LinkedAccount } from "@prisma/client";

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function findUserByShortRef(shortRef: string) {
  return prisma.user.findUnique({ where: { shortRef } });
}

/** Case-insensitive by virtue of the `slug` citext column (§H.2). */
export function findUserBySlug(slug: string) {
  return prisma.user.findUnique({ where: { slug } });
}

export function updateUserProfile(
  id: string,
  data: { displayName: string; bio: string | null; avatarUrl?: string; onboardedAt?: Date },
) {
  return prisma.user.update({ where: { id }, data });
}

export function updateUserAvatar(id: string, avatarUrl: string) {
  return prisma.user.update({ where: { id }, data: { avatarUrl } });
}

export type IdentityAccounts = {
  /** The active main 分身, featured on top (null if none / main is flagged). */
  main: LinkedAccount | null;
  /** Active non-main 分身, oldest-verified first (most credible). */
  active: LinkedAccount[];
  /** banned/hacked 分身 — rendered last as warning rows, no click-out. */
  flagged: LinkedAccount[];
  /** Owner-only private rows (empty for non-owners), oldest-first. */
  privateAccounts: LinkedAccount[];
  /** Badge count: active public accounts only (excludes private + flagged). */
  count: number;
};

/**
 * Read model for the public Identity Card. Loads a 正身's verified 分身, applies
 * the visibility filter, and splits them into render buckets.
 * Pass `includePrivate: true` only when the viewer is the owner.
 */
export async function listIdentityAccounts(
  userId: string,
  opts: { includePrivate: boolean },
): Promise<IdentityAccounts> {
  const rows = await prisma.linkedAccount.findMany({
    where: {
      userId,
      status: "verified",
      ...(opts.includePrivate ? {} : { visibility: "public" }),
    },
    orderBy: { verifiedAt: "asc" }, // oldest-verified first → most credible (§6.7)
  });

  const publicRows = rows.filter((r) => r.visibility === "public");
  const privateAccounts = rows.filter((r) => r.visibility === "private");

  const main = publicRows.find((r) => r.isMain && r.condition === "active") ?? null;
  const flagged = publicRows.filter((r) => r.condition !== "active");
  const active = publicRows.filter(
    (r) => r.condition === "active" && r.id !== main?.id,
  );
  const count = (main ? 1 : 0) + active.length;

  return { main, active, flagged, privateAccounts, count };
}
