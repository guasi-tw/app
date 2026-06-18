// lib/binding/platforms/instagram.ts
// Self-contained Instagram adapter (Approach A — mirrors threads.ts, no shared fetch abstraction).
// IG serves OG meta to Meta's crawler UA on POST pages (verified 2026-06-18): the author comes from
// the og:url canonical path (authoritative under any pasted handle — spoof-proven), and the auth code
// is scanned from the decoded SSR body. Bio is NOT readable tokenless (profile og:description is a
// follower-count template) → post-method only. Scope: /p/<shortcode>/ posts only (images canonicalize
// to /p/; /reel/ videos are rejected). Source of truth: docs/platform-verification.md §3.2.
import { FB_CRAWLER_UA } from "../constants";
import { textHasCode } from "../code";
import type { ParsedPostUrl, PlatformAdapter, ResolvedPost } from "./types";

const ALLOWED_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname);
}

// Canonical post path: /p/{shortcode}/ or /{handle}/p/{shortcode}/. The handle is parsed but NOT
// trusted — the author comes from og:url (platform authority). /reel/ is out of scope.
const POST_PATH = /^\/(?:[^/]+\/)?p\/([A-Za-z0-9_-]+)\/?$/;

function parsePostUrl(raw: string): ParsedPostUrl | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (!isAllowedHost(u.hostname)) return null;
  const m = u.pathname.match(POST_PATH);
  if (!m) return null;
  // Keep any ?igsh=… (harmless for fetching); the stored canonical comes from og:url (query-free).
  return { postId: m[1], fetchUrl: u.toString() };
}

async function resolvePost(_parsed: ParsedPostUrl, _code: string): Promise<ResolvedPost> {
  throw new Error("not implemented"); // replaced in Task 2
}

export const instagramAdapter: PlatformAdapter = {
  key: "instagram",
  label: "Instagram",
  // The official guasi handle on Instagram — the registered IG/Threads handle @gua.si.tw (decided
  // 2026-06-18). A growth/discoverability tag in the post template, NOT a security check.
  serviceTag: "@gua.si.tw",
  hashtag: "#guasi", // IG hashtags are pasteable/clickable (unlike Threads topics)
  slugEligible: true, // §A.4 — IG/Threads may mint a slug
  postUrlPlaceholder: "https://www.instagram.com/p/…",
  profileUrl: (handle: string) => `https://www.instagram.com/${handle}/`,
  parsePostUrl,
  resolvePost, // defined in Task 2
  // composeIntentUrl intentionally OMITTED — IG has no web compose intent (wizard guards on presence).
};
