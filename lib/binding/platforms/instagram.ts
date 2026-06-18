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

// Minimal HTML-entity decode — IG OG/body content is entity-encoded (`&#064;`=@, hex numeric for CJK:
// the 我是分身驗證碼： label arrives as &#x6211;…&#xff1a; — a literal match never fires without this).
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}

function metaContent(html: string, property: string): string | null {
  // Tolerate attribute order: property before OR after content. Decode entities on the way out.
  // LIMITATION (matches threads.ts): the `[^"']*` content group stops at the first literal quote OR
  // apostrophe, so an apostrophe inside og:title truncates the captured value. Bounded impact — only
  // displayName parses from og:title; the author comes from og:url (a pure URL) and the code from the
  // decoded body, so a truncated og:title can never cause a wrong bind, only a clipped display name.
  const a = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
  );
  if (a) return decodeEntities(a[1]);
  const b = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
  );
  return b ? decodeEntities(b[1]) : null;
}

async function fetchHtml(fetchUrl: string): Promise<string> {
  const resp = await fetch(fetchUrl, {
    headers: { "User-Agent": FB_CRAWLER_UA },
    redirect: "follow", // a spoofed-handle path redirects toward the canonical author URL
  });
  if (!resp.ok) throw new Error(`Instagram fetch failed: ${resp.status}`);
  // Re-validate the FINAL host after following redirects — author must come from a platform domain
  // (§6.3). Fail CLOSED: a missing/unparseable final URL is treated as off-platform, never trusted.
  let finalHost = "";
  try {
    finalHost = new URL(resp.url).hostname;
  } catch {
    /* unparseable/empty resp.url → finalHost stays "" → fails the allowlist below */
  }
  if (!isAllowedHost(finalHost)) {
    throw new Error(`Instagram fetch redirected off-platform: ${resp.url}`);
  }
  return resp.text();
}

// og:url canonicalizes to instagram.com/{handle}/p/{shortcode}/ — the AUTHORITATIVE author, regardless
// of the pasted path handle (spoof-proven 2026-06-18). The regex pins the host, so a spoofed og:url
// host (evil.com/…, instagram.com.evil.com/…) fails to match → null → resolvePost throws (fail closed).
const OG_URL_HANDLE = /^https?:\/\/(?:www\.)?instagram\.com\/([^/]+)\/p\/[A-Za-z0-9_-]+\/?$/i;

/** Parse the authoritative author handle from og:url (host pinned by the regex). */
function parseAuthorHandle(ogUrl: string): string | null {
  const m = ogUrl.match(OG_URL_HANDLE);
  return m ? m[1].trim().toLowerCase() : null;
}

// og:title has TWO shapes (after entity-decode), verified 2026-06-18:
//   "<Name> on Instagram: …"   — when the account has a display name
//   "@<handle> on Instagram: …" — bare form when it doesn't (e.g. @gua.si.dev)
/** Display name from og:title, or null for the bare @handle form. */
function parseDisplayName(title: string | null): string | null {
  if (!title) return null;
  const prefix = title.split(" on Instagram:")[0]?.trim() ?? "";
  if (!prefix || prefix.startsWith("@")) return null;
  return prefix;
}

async function resolvePost(parsed: ParsedPostUrl, code: string): Promise<ResolvedPost> {
  let html = await fetchHtml(parsed.fetchUrl);
  let ogUrl = metaContent(html, "og:url");
  if (!ogUrl) {
    // IG SSR is occasionally flaky — retry once (platform-verification §3.2).
    html = await fetchHtml(parsed.fetchUrl);
    ogUrl = metaContent(html, "og:url");
  }
  // Author = og:url canonical (authority). The regex also pins the host, so an off-platform og:url
  // yields null → throw. Never derive the author from the user-supplied path. The combined guard
  // narrows ogUrl to a non-null string for canonicalUrl below.
  const handle = ogUrl ? parseAuthorHandle(ogUrl) : null;
  if (!ogUrl || !handle) throw new Error("Instagram: could not resolve author from og:url");

  const displayName = parseDisplayName(metaContent(html, "og:title"));

  // The caption (carrying the code) is SSR'd into the body untruncated. Decode the whole body and scan
  // for the namespaced code — og:description truncates and our code sits last in the template. The
  // author is pinned by og:url (authority), so scanning the body for the scoped code is safe (§3.1).
  const body = decodeEntities(html);
  const codePresent = textHasCode(body, code);

  // The clean, query-free canonical (built by IG from the true author) — stored as proof_post_url.
  const canonicalUrl = ogUrl; // narrowed to string by the guard above

  return { accountId: handle, handle, displayName, codePresent, canonicalUrl };
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
