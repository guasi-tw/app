// lib/binding/platforms/index.ts
import type { PlatformAdapter } from "./types";
import { threadsAdapter } from "./threads";
import { miinAdapter } from "./miin";
import { instagramAdapter } from "./instagram";

// Adding a platform = add its adapter to this map. (Presentation is separate: also register the
// platform's glyph + brand color in PlatformIcon — see docs/product-decisions.md "Platform icon
// brand identity". Icons are intentionally NOT gated on an adapter so 施工中 tiles can still show
// their brand mark. miin's glyph is a deferred follow-up — see the spec §6.)
const ADAPTERS: Partial<Record<string, PlatformAdapter>> = {
  threads: threadsAdapter,
  miin: miinAdapter,
  instagram: instagramAdapter,
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
