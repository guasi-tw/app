// app/add/[platform]/wizardRequest.ts
import { redirect } from "next/navigation";
import { findRequestById, isExpired } from "@/lib/binding/repo";

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
  const req = await findRequestById(rid);
  const live =
    req && req.userId === userId && req.platform === platform && req.status === "pending" && !isExpired(req);
  if (!live) {
    redirect(`/add/${platform}${recover ? `?recover=${encodeURIComponent(recover)}` : ""}`);
  }
  return req;
}
