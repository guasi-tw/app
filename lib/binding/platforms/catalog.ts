// lib/binding/platforms/catalog.ts
// Static, presentation-level list of every MVP platform shown in the /add picker — INCLUDING
// any 施工中 platform that has no adapter yet. `slugEligible` must be known even
// without an adapter so the picker can hide slug-ineligible platforms during onboarding: a
// slug-less user's first bind becomes their main 分身, which must mint a slug. Keep each entry's
// `slugEligible` in sync with the matching adapter's — guarded by catalog.test.ts.
import type { PlatformKey } from "./types";

export type PlatformCatalogEntry = {
  key: PlatformKey;
  label: string;
  slugEligible: boolean;
};

export const PLATFORM_CATALOG: readonly PlatformCatalogEntry[] = [
  { key: "threads", label: "Threads", slugEligible: true },
  { key: "instagram", label: "Instagram", slugEligible: true },
  { key: "miin", label: "miin.cc", slugEligible: false },
] as const;

/**
 * Platforms to show in the /add picker. A slug-less (onboarding) user sees ONLY slug-eligible
 * platforms — their first bind becomes the main 分身 and must mint a slug, so slug-ineligible
 * platforms (miin) are hidden entirely rather than shown-disabled. A provisioned user (hasSlug)
 * sees all platforms. The recover flow bypasses the picker, so it's unaffected.
 */
export function pickablePlatforms(hasSlug: boolean): PlatformCatalogEntry[] {
  return PLATFORM_CATALOG.filter((p) => hasSlug || p.slugEligible);
}
