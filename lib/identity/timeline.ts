import { prisma } from "@/lib/db/client";
import type { BindingEventType } from "@prisma/client";

/** A timeline row before view-formatting. Genesis is synthetic (kind "genesis"). */
export type TimelineEntry = {
  /** Event id, or "genesis" for the synthetic 建立正身 anchor. */
  id: string;
  kind: BindingEventType | "genesis";
  createdAt: Date;
  /** Platform key (drives the icon); null for genesis. */
  platform: string | null;
  /** null for genesis. */
  handle: string | null;
  /** Set only when the event carries a ProofRecord (bound / re_verified); null otherwise. */
  proofPostUrl: string | null;
  /** The account is currently private (owner view only; always false for genesis). */
  isPrivate: boolean;
};

/**
 * Read model for the Identity Card timeline. Joins BindingEvent → LinkedAccount →
 * ProofRecord in application code (no Prisma relations between them) and applies the
 * per-account current-visibility leak filter. Pass `includePrivate: true` only for the owner.
 *
 * Leak defense (decision 1): an event is shown publicly iff its account is `public` RIGHT NOW.
 * A disclosed account's entire history (incl. the while-private `bound`) appears at once.
 */
export async function listTimelineEvents(
  userId: string,
  opts: { includePrivate: boolean },
): Promise<TimelineEntry[]> {
  // 1. The user (for the genesis anchor) + their accounts (to resolve each event).
  const [user, accounts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardedAt: true, createdAt: true },
    }),
    prisma.linkedAccount.findMany({
      where: { userId },
      select: { platform: true, accountId: true, handle: true, visibility: true },
    }),
  ]);

  const acctByKey = new Map(
    accounts.map((a) => [`${a.platform}:${a.accountId}`, a]),
  );

  // 2. Events oldest-first (index [userId, createdAt] already exists).
  const events = await prisma.bindingEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  // 3. Resolve + filter.
  const resolved = events
    .map((e) => ({ e, acct: acctByKey.get(`${e.platform}:${e.accountId}`) }))
    .filter(({ acct }) => acct !== undefined) // defensive: skip orphan events
    .filter(({ acct }) => opts.includePrivate || acct!.visibility === "public");

  // 4. Batch-fetch proof URLs for the events that carry one.
  const proofIds = resolved
    .map(({ e }) => e.proofRecordId)
    .filter((id): id is string => id !== null);
  const proofs = proofIds.length
    ? await prisma.proofRecord.findMany({
        where: { id: { in: proofIds } },
        select: { id: true, proofPostUrl: true },
      })
    : [];
  const proofUrlById = new Map(proofs.map((p) => [p.id, p.proofPostUrl]));

  const eventEntries: TimelineEntry[] = resolved.map(({ e, acct }) => ({
    id: e.id,
    kind: e.eventType,
    createdAt: e.createdAt,
    platform: acct!.platform,
    handle: acct!.handle,
    proofPostUrl: e.proofRecordId ? proofUrlById.get(e.proofRecordId) ?? null : null,
    isPrivate: acct!.visibility !== "public",
  }));

  // 5. Prepend the synthetic genesis anchor (onboardedAt ?? createdAt; never private).
  const genesis: TimelineEntry = {
    id: "genesis",
    kind: "genesis",
    createdAt: user?.onboardedAt ?? user?.createdAt ?? new Date(0),
    platform: null,
    handle: null,
    proofPostUrl: null,
    isPrivate: false,
  };

  return [genesis, ...eventEntries];
}
