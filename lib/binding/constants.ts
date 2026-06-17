// lib/binding/constants.ts
// Shared binding constants. Kept tiny + dependency-free so both server actions
// and the platform adapters can import them.

/**
 * Auth-code TTL (§H.1 `expired`). 5 min — the whole compose→post→paste-back flow is seconds,
 * so a short live-code window is plenty (decided 2026-06-16). Failed attempts don't consume the
 * code, and the user can regenerate a fresh request anytime, so a tight window costs little.
 */
export const BINDING_CODE_TTL_MINUTES = 5;

/** Public origin used to build the profile URL embedded in the verification post (§D.2.1). */
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://guasi.tw";

/** Meta's crawler UA — triggers Threads/IG server-side OG rendering (platform-verification §3.1). */
export const FB_CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

/**
 * The Chinese label that namespaces the 6-digit code in the post (§D.2.1). The verifier
 * matches `CODE_LABEL` + digits, so an arbitrary 6-digit number elsewhere never false-matches.
 */
export const CODE_LABEL = "我是分身驗證碼：";
