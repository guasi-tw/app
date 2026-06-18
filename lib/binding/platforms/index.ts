// lib/binding/platforms/index.ts
import type { PlatformAdapter } from "./types";
import { threadsAdapter } from "./threads";

// Slice 2: Threads only. Adding IG/miin later = add their adapter to this map. (Presentation is
// separate: also register the platform's glyph + brand color in PlatformIcon — see
// docs/product-decisions.md "Platform icon brand identity". Icons are intentionally NOT gated on an
// adapter so 施工中 tiles can still show their brand mark.)
const ADAPTERS: Partial<Record<string, PlatformAdapter>> = {
  threads: threadsAdapter,
};

/** Look up an adapter by route param. Returns undefined for unknown/not-yet-built platforms (→ 404). */
export function getAdapter(platform: string): PlatformAdapter | undefined {
  return ADAPTERS[platform];
}

/** Adapters whose handles can mint a slug (§A.4) — used by the §D.5 setup picker. */
export function listSlugEligible(): PlatformAdapter[] {
  return Object.values(ADAPTERS).filter(
    (a): a is PlatformAdapter => !!a && a.slugEligible,
  );
}
