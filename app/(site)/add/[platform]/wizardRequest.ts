// app/add/[platform]/wizardRequest.ts
import { redirect } from "next/navigation";
import type { Platform } from "@prisma/client";
import { findLiveRequest } from "@/lib/binding/repo";

/**
 * Resolve the wizard's binding request for ANY platform on the shared `/add/[platform]` route
 * (Threads, miin, and every future platform go through the same dynamic route, so this rule is
 * defined once, here — not per platform).
 *
 * - **No `rid`** → returns `null`; the caller renders the "produce template" screen.
 * - **`rid` is the caller's own LIVE request** (owned, this platform, `pending`, unexpired) → returns
 *   it; the caller renders the wizard.
 * - **`rid` is anything else** — non-existent, another user's, wrong platform, `expired`, `resolved`,
 *   `verified`, or `cancelled` → `redirect` to a clean `/add/{platform}` (preserving `recover`) and
 *   never returns. This strips a stale/foreign token from the URL: clean UX + defense-in-depth, and
 *   it never reveals which of those states the `rid` was in (every not-live case lands identically).
 */
export async function loadWizardRequest(
  platform: string,
  userId: string,
  rid: string,
  recover: string,
) {
  if (!rid) return null;
  // The (ownership + platform + pending + unexpired) gate is enforced in the DB query, so a stale,
  // foreign, expired, or used rid all come back null — strip it from the URL (preserving recover).
  const req = await findLiveRequest(rid, userId, platform as Platform);
  if (!req) {
    redirect(`/add/${platform}${recover ? `?recover=${encodeURIComponent(recover)}` : ""}`);
  }
  return req;
}
