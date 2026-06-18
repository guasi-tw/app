// lib/binding/constants.ts
// Shared binding constants. Kept tiny + dependency-free so both server actions
// and the platform adapters can import them.

/**
 * Auth-code TTL (§H.1 `expired`). 30 min — the security of a binding comes from the author-match +
 * scope + single-use, NOT from a tight expiry window, so the TTL only needs to outlast a realistic
 * compose→post→paste-back session (incl. the user getting distracted, switching apps, or composing
 * on a phone). 5 min (the original) was too tight in practice; 30 min comfortably covers an
 * interrupted flow. Failed attempts don't consume the code, and the user can regenerate anytime.
 */
export const BINDING_CODE_TTL_MINUTES = 30;

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
