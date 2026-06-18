import { listTimelineEvents } from "@/lib/identity/timeline";
import { getAdapter } from "@/lib/binding/platforms";
import type { BindingEventType } from "@prisma/client";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD — matches accounts.ts
}

/** Plain, serialisable timeline row the server hands to the client card. */
export type TimelineView = {
  /** Event id, or "genesis". */
  id: string;
  /** Pre-formatted YYYY-MM-DD. */
  date: string;
  kind: BindingEventType | "genesis";
  /** null for genesis. */
  handle: string | null;
  /** Platform key → PlatformIcon; null for genesis. */
  platform: string | null;
  /** adapter.label; null for genesis. */
  platformLabel: string | null;
  /** Set only on bound / re_verified. */
  proofPostUrl: string | null;
  /** Account currently private (owner view only; always false for genesis). */
  isPrivate: boolean;
};

/**
 * Build the serialisable timeline for the Identity Card. Owner (`isOwner`) gets the full
 * list (private entries flagged `isPrivate`); non-owners never receive private entries
 * from the server (defense in depth) — see listTimelineEvents.
 */
export async function buildTimeline(
  userId: string,
  isOwner: boolean,
): Promise<TimelineView[]> {
  const entries = await listTimelineEvents(userId, { includePrivate: isOwner });
  return entries.map((e) => {
    const adapter = e.platform ? getAdapter(e.platform) : null;
    const hasProof = e.kind === "bound" || e.kind === "re_verified";
    return {
      id: e.id,
      date: fmtDate(e.createdAt),
      kind: e.kind,
      handle: e.handle,
      platform: e.platform,
      platformLabel: e.platform ? adapter?.label ?? e.platform : null,
      proofPostUrl: hasProof ? e.proofPostUrl : null,
      isPrivate: e.isPrivate,
    };
  });
}
