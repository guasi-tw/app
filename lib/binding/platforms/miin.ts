// lib/binding/platforms/miin.ts
// Self-contained miin.cc adapter (Approach A — mirrors threads.ts, no shared fetch abstraction).
// miin is a client-rendered SPA whose page HTML is author-less, but it exposes a public,
// unauthenticated JSON API (api.miin.cc) that returns the post author + full text inline — the
// lightest read path of the three MVP platforms (one fetch + JSON.parse, no scraping).
// Source of truth for read mechanics: docs/platform-verification.md §3.3.
import { textHasCode } from "../code";
import type { ParsedPostUrl, PlatformAdapter, ResolvedPost } from "./types";

// Canonical story path: /story/<numeric id>. The id is the trailing number of miin.cc/story/<id>.
const STORY_PATH = /^\/story\/(\d+)\/?$/;

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

async function resolvePost(_parsed: ParsedPostUrl, _code: string): Promise<ResolvedPost> {
  throw new Error("miin.resolvePost not implemented");
}

export const miinAdapter: PlatformAdapter = {
  key: "miin",
  label: "miin.cc",
  // guasi's miin handle — growth/discoverability decoration in the post template, NOT a security check.
  serviceTag: "@gua_si_tw",
  hashtag: "#guasi", // miin supports pasteable hashtags
  slugEligible: false, // a miin handle may not mint a slug (§1 out-of-scope rationale)
  profileUrl: (handle: string) => `https://miin.cc/user/${handle}`,
  parsePostUrl,
  resolvePost,
  // composeIntentUrl intentionally OMITTED — miin has no prefilled compose intent (wizard shows
  // copy-paste only). The optional member stays undefined; the wizard already guards on its presence.
};
