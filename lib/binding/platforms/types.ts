// lib/binding/platforms/types.ts
// The PlatformAdapter seam (§D.2). Each platform declares its URL pattern, its read
// mechanism, its compose affordance, and whether it can mint a slug. Only Threads ships
// in Slice 2; IG/miin slot in later without touching the rest of the system.

/** Matches the Prisma `Platform` enum values. */
export type PlatformKey = "threads" | "instagram" | "miin";

/** A canonical post URL parsed into the bits we trust: platform + an authoritative fetch URL. */
export type ParsedPostUrl = {
  postId: string;
  /** A canonical URL on the REAL platform domain to read the author from (host already validated). */
  fetchUrl: string;
};

/**
 * The resolved post — author + code-presence + canonical URL, all from PLATFORM AUTHORITY
 * (never user page content, §6.3). One fetch produces all of it (see `resolvePost`).
 */
export type ResolvedPost = {
  /** Authoritative account id (lowercased handle for Threads). Becomes LinkedAccount.accountId. */
  accountId: string;
  handle: string;
  displayName: string | null;
  /** Whether the post's text contains this binding request's namespaced code (scanned by the adapter). */
  codePresent: boolean;
  /** The clean, query-free canonical post URL (stored as `proof_records.proof_post_url`, §E.2). */
  canonicalUrl: string;
};

export interface PlatformAdapter {
  readonly key: PlatformKey;
  /** UI label, e.g. "Threads". */
  readonly label: string;
  /** Per-platform official guasi handle for the post template (§D.2.1) — growth, NOT a security check. */
  readonly serviceTag: string;
  /**
   * Per-platform leading hashtag for the template, or `null` to omit it (§D.2.1, revised 2026-06-16).
   * Threads = `null` (it uses topics, not pasteable hashtags); IG (later) = "#guasi".
   */
  readonly hashtag: string | null;
  /** Whether a slug may be minted from a handle proven here (§A.4 — IG/Threads yes, miin no). */
  readonly slugEligible: boolean;
  /** Example post URL shown as the paste-input placeholder in the wizard (per-platform, not Threads-only). */
  readonly postUrlPlaceholder: string;

  /** Live public profile URL for a stored (bare, no leading @) handle. */
  profileUrl(handle: string): string;

  /**
   * Validate the pasted URL against THIS platform + parse out the post id (§D.2 security gate).
   * Returns null for wrong-platform domains, look-alike hosts, non-HTTPS, or non-canonical paths.
   */
  parsePostUrl(url: string): ParsedPostUrl | null;

  /**
   * One fetch from platform authority (§6.3): resolve the author, check whether the post text
   * contains `code`, and return the clean canonical URL. Throws on fetch/parse failure.
   * (The author always comes from authority — og:title for Threads; the code is scanned from the
   * SSR'd post body, NOT og:description, which Threads omits when the post contains a link.)
   */
  resolvePost(parsed: ParsedPostUrl, code: string): Promise<ResolvedPost>;

  /** A prefilled compose-intent URL if the platform has one (Threads does; IG/miin don't). */
  composeIntentUrl?(text: string): string;
}
