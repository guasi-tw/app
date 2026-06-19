// lib/binding/platforms/threads.ts
import { FB_CRAWLER_UA } from "../constants";
import { textHasCode } from "../code";
import type { ParsedPostUrl, PlatformAdapter, ResolvedPost } from "./types";

// Threads migrated threads.net → threads.com; accept BOTH (+ www). A pasted threads.net URL
// 301-redirects to threads.com, and any wrong path handle 301-redirects to the canonical
// true-author URL (verified 2026-06-16) — so we FOLLOW redirects and re-validate the final host.
const ALLOWED_HOSTS = new Set([
  "threads.net",
  "www.threads.net",
  "threads.com",
  "www.threads.com",
]);

// Canonical post path: /@{handle}/post/{postId}. The handle is parsed but NOT trusted — the
// author comes from og:title (platform authority); a spoofed path canonicalizes to the real author.
const POST_PATH = /^\/@[^/]+\/post\/([A-Za-z0-9_-]+)\/?$/;

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTS.has(hostname);
}

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
  // Fetch the validated pasted URL and FOLLOW the redirect to the canonical author URL;
  // resolvePost re-validates the FINAL host so we never read an author off a non-platform page.
  // `u.toString()` keeps any ?xmt=… query — harmless for fetching (200 either way); the STORED
  // proof URL is reconstructed query-free from the authoritative handle (see resolvePost).
  return { postId: m[1], fetchUrl: u.toString() };
}

// Minimal HTML-entity decode — Threads OG content is entity-encoded (`&#064;` = @, hex for CJK).
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m);
}

function metaContent(html: string, property: string): string | null {
  // Tolerate attribute order: property before OR after content. Decode entities on the way out.
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
    redirect: "follow", // .net→.com and spoofed-handle→canonical are legitimate 301s
  });
  if (!resp.ok) throw new Error(`Threads fetch failed: ${resp.status}`);
  // Re-validate the FINAL host after following redirects — author must come from a platform domain (§6.3).
  // Fail CLOSED: a missing or unparseable final URL is treated as off-platform, never trusted.
  let finalHost = "";
  try {
    finalHost = new URL(resp.url).hostname;
  } catch {
    /* unparseable/empty resp.url → finalHost stays "" → fails the allowlist below */
  }
  if (!isAllowedHost(finalHost)) {
    throw new Error(`Threads fetch redirected off-platform: ${resp.url}`);
  }
  return resp.text();
}

// og:title has TWO shapes (after entity-decode), verified 2026-06-16:
//   "<name> (@<handle>) on Threads"  — when the account has a display name
//   "@<handle> on Threads"           — bare form when it doesn't (e.g. @gua.si.tw)
const OG_TITLE_NAMED = /^(.*?)\s*\(@([^)]+)\)\s*on Threads$/;
const OG_TITLE_BARE = /^@(\S+)\s+on Threads$/;

/** Parse author handle + optional display name from a decoded og:title. */
function parseAuthor(title: string): { handle: string; displayName: string | null } | null {
  const named = title.match(OG_TITLE_NAMED);
  if (named) return { displayName: named[1].trim() || null, handle: named[2].trim().toLowerCase() };
  const bare = title.match(OG_TITLE_BARE);
  if (bare) return { displayName: null, handle: bare[1].trim().toLowerCase() };
  return null;
}

async function resolvePost(parsed: ParsedPostUrl, code: string): Promise<ResolvedPost> {
  let html = await fetchHtml(parsed.fetchUrl);
  let title = metaContent(html, "og:title");
  if (!title) {
    // Threads SSR is occasionally flaky — retry once (platform-verification §3.2 gotcha).
    html = await fetchHtml(parsed.fetchUrl);
    title = metaContent(html, "og:title");
  }
  const author = title ? parseAuthor(title) : null;
  if (!author) throw new Error("Threads: could not resolve author from og:title");

  // The caption is NOT in og:description when the post contains a link (verified 2026-06-16) —
  // it lives in the SSR'd body. Decode the whole body and scan for the namespaced code. The author
  // is still pinned by og:title (authority), so scanning the body for the scoped code is safe.
  const body = decodeEntities(html);
  const codePresent = textHasCode(body, code);

  // Reconstruct the canonical URL from the AUTHORITATIVE handle + postId — query-free (drops the
  // pasted ?xmt=… tracking token) and not derived from the user-supplied path.
  const canonicalUrl = `https://www.threads.com/@${author.handle}/post/${parsed.postId}`;

  return { accountId: author.handle, handle: author.handle, displayName: author.displayName, codePresent, canonicalUrl };
}

export const threadsAdapter: PlatformAdapter = {
  key: "threads",
  label: "Threads",
  // The official guasi handle on Threads — the registered IG/Threads handle `@gua.si.tw`
  // (CLAUDE.md "Name" locked decision). Appears verbatim in the post template as the
  // per-platform `service_tag` (§D.2.1) — a growth/discoverability tag, NOT a security check.
  serviceTag: "@gua.si.tw",
  hashtag: null, // Threads uses topics, not pasteable #tags (decided 2026-06-16) — omit it
  slugEligible: true, // §A.4 — IG/Threads may mint a slug
  postUrlPlaceholder: "https://www.threads.com/@你的帳號/post/…",
  postUrlHelp: [
    { text: "按下圖示", image: "/help/threads/step-1.webp" },
    { text: "按下圖示", image: "/help/threads/step-2.webp" },
    { text: "複製完成，回到此處貼上連結", image: "/help/threads/step-3.webp" },
  ],
  profileUrl: (handle: string) => `https://www.threads.com/@${handle}`,
  parsePostUrl,
  resolvePost,
  composeIntentUrl: (text: string) =>
    `https://www.threads.com/intent/post?text=${encodeURIComponent(text)}`,
};
