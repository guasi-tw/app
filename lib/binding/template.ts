// lib/binding/template.ts
import { SITE_ORIGIN, CODE_LABEL } from "./constants";

/** The profile URL embedded in the post: short /r/ link pre-provisioning, /gua/ once minted (§D.2.1). */
export function profileUrlFor(user: { slug: string | null; shortRef: string }): string {
  return user.slug ? `${SITE_ORIGIN}/gua/${user.slug}` : `${SITE_ORIGIN}/r/${user.shortRef}`;
}

/**
 * The copy-able verification post (§D.2.1) — doubles as the growth engine.
 * `hashtag` is per-platform + OPTIONAL: Threads passes `null` (it uses "topics", which a pasted
 * `#tag` does not create — decided 2026-06-16) so the post leads with the `serviceTag` (@gua.si.tw);
 * IG (later) can pass "#guasi". `service_tag` is per-platform (the adapter supplies it). The code is
 * namespaced by `CODE_LABEL` so the verifier never false-matches a stray number, and placed early as
 * belt-and-suspenders (we scan the full SSR body for the code, not the truncatable og:description).
 */
export function buildVerificationPost(params: {
  hashtag: string | null;
  serviceTag: string;
  profileUrl: string;
  code: string;
}): string {
  const { hashtag, serviceTag, profileUrl, code } = params;
  const lines = [
    serviceTag,
    "我是分身認證貼文",
    "",
    "點此觀看此帳號的正身：",
    profileUrl,
    "",
    `${CODE_LABEL}${code}`,
  ];
  return (hashtag ? [hashtag, "", ...lines] : lines).join("\n");
}
