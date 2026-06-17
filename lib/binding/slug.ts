// lib/binding/slug.ts
import { findUserBySlug } from "@/lib/identity/repo";

/**
 * The slug IS exactly a proven handle (§3) — NEVER a guasi-synthesized string (§D.4 resolves §4.3):
 * synthesizing `{handle}-ig`/`{handle}2` would break the handle-derived anti-squatting invariant.
 * So this is just a trim; the only legitimate slug source is a handle the user proved.
 */
export function deriveSlug(handle: string): string {
  return handle.trim();
}

/**
 * UX pre-check for §D.4 (case-insensitive via the citext slug column, §H.2). This is advisory only —
 * the real first-claim-wins guarantee is the `User.slug` unique index, enforced at commit (Task 9).
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  return (await findUserBySlug(slug)) === null;
}
