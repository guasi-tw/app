// lib/binding/platforms/miin.ts
// Self-contained miin.cc adapter (Approach A — mirrors threads.ts, no shared fetch abstraction).
// miin is a client-rendered SPA whose page HTML is author-less, but it exposes a public,
// unauthenticated JSON API (api.miin.cc) that returns the post author + full text inline — the
// lightest read path of the three MVP platforms (one fetch + JSON.parse, no scraping).
// Source of truth for read mechanics: docs/platform-verification.md §3.3.
import { textHasCode } from "../code";
import type { ParsedPostUrl, PlatformAdapter, ResolvedPost } from "./types";

// miin's API is UNOFFICIAL (public + unauthenticated today, versioned v2/v3, could add auth /
// rate-limits / change shape without notice). Every failure logs ONE structured, greppable line
// (Vercel runtime logs — no log-aggregation service yet) then throws, so an operator can tell WHY
// it broke. `kind` makes a lockdown (auth_required / rate_limited) visually distinct from a
// transient blip (network) or a silent contract break (shape_mismatch) at a glance.
type FailureKind = "network" | "auth_required" | "rate_limited" | "http_error" | "shape_mismatch";

function failResolve(kind: FailureKind, storyId: string, status: number | null, message: string): never {
  // NO PII, and NEVER the auth code — storyId is a public id; `message` is a fetch/HTTP detail only.
  console.error("[miin.resolvePost] fetch failed", { kind, storyId, status, message });
  throw new Error(`miin.resolvePost failed: ${kind}`);
}

// Canonical story path: /story/<numeric id>. The id is the trailing number of miin.cc/story/<id>.
const STORY_PATH = /^\/story\/(\d+)\/?$/;

// Concatenate the `.text` of every title + content segment. Both are arrays (§3.3): short posts
// carry text in `title` with `content` empty; longer posts fill `content`. The API returns the
// FULL untruncated text, so the Threads/IG "place the code early" truncation gotcha does NOT apply.
function segmentsText(segs: unknown): string {
  if (!Array.isArray(segs)) return "";
  return segs
    .map((s) => (s && typeof (s as { text?: unknown }).text === "string" ? (s as { text: string }).text : ""))
    .join("\n");
}

function parsePostUrl(raw: string): ParsedPostUrl | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  // Host must EQUAL miin.cc exactly — rejects look-alikes (miin.cc.evil.com, notmiin.cc),
  // subdomains (www.miin.cc), and every non-miin.cc host.
  if (u.hostname !== "miin.cc") return null;
  const m = u.pathname.match(STORY_PATH);
  if (!m) return null;
  const storyId = m[1];
  // fetchUrl is CONSTRUCTED from the validated numeric id — never a user-supplied host (§3.1).
  return { postId: storyId, fetchUrl: `https://api.miin.cc/web/story/v3/story?storyId=${storyId}` };
}

async function resolvePost(parsed: ParsedPostUrl, code: string): Promise<ResolvedPost> {
  const storyId = parsed.postId;

  let resp: Response;
  try {
    resp = await fetch(parsed.fetchUrl, { headers: { Accept: "application/json" } });
  } catch (e) {
    failResolve("network", storyId, null, e instanceof Error ? e.message : String(e));
  }

  if (!resp.ok) {
    const kind: FailureKind =
      resp.status === 401 || resp.status === 403 ? "auth_required"
      : resp.status === 429 ? "rate_limited"
      : "http_error";
    failResolve(kind, storyId, resp.status, `HTTP ${resp.status}`);
  }

  let body: unknown;
  try {
    body = await resp.json();
  } catch (e) {
    failResolve("shape_mismatch", storyId, resp.status, e instanceof Error ? e.message : String(e));
  }

  // Authoritative author — miin's own data keyed by the storyId we validated (§6.3), never parsed
  // from user page content. Nested shape per platform-verification §3.3.
  const data = (body as { story?: { data?: Record<string, unknown> } })?.story?.data;
  const authorData = (data?.author as { data?: Record<string, unknown> } | undefined)?.data;
  const username = authorData?.username;
  if (!data || typeof username !== "string" || !username.trim()) {
    failResolve("shape_mismatch", storyId, resp.status, "missing story.data.author.data.username");
  }

  const handle = username; // as returned (§3.2)
  const accountId = handle.trim().toLowerCase(); // deterministic per-owner key (§3.4 recovery guard)
  // Display name = the author's `nickname` (the only name field miin returns). miin defaults
  // nickname to the username, so treat nickname == username as "no distinct display name" (null) —
  // matching Threads' bare-handle semantics.
  const nickname = typeof authorData!.nickname === "string" ? authorData!.nickname.trim() : "";
  const displayName = nickname && nickname.toLowerCase() !== accountId ? nickname : null;
  const text = `${segmentsText(data.title)}\n${segmentsText(data.content)}`;
  const codePresent = textHasCode(text, code);
  const canonicalUrl = `https://miin.cc/story/${storyId}`; // clean, query-free (stored as proof_post_url)

  return { accountId, handle, displayName, codePresent, canonicalUrl };
}

export const miinAdapter: PlatformAdapter = {
  key: "miin",
  label: "miin.cc",
  // guasi's miin handle — growth/discoverability decoration in the post template, NOT a security check.
  serviceTag: "@gua_si_tw",
  hashtag: "#guasi", // miin supports pasteable hashtags
  slugEligible: false, // a miin handle may not mint a slug (§1 out-of-scope rationale)
  postUrlPlaceholder: "https://miin.cc/story/…",
  postUrlHelp: [
    { text: "按下圖示", image: "/help/miin/step-1.webp" },
    { text: "按下圖示", image: "/help/miin/step-2.webp" },
    { text: "按下圖示並複製完成，回到此處貼上連結", image: "/help/miin/step-3.webp" },
  ],
  profileUrl: (handle: string) => `https://miin.cc/user/${handle}`,
  parsePostUrl,
  resolvePost,
  // composeIntentUrl intentionally OMITTED — miin has no prefilled compose intent (wizard shows
  // copy-paste only). The optional member stays undefined; the wizard already guards on its presence.
};
