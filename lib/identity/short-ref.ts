import { randomInt } from "node:crypto";

/** base62 — short, URL-safe, no ambiguous separators. */
export const SHORT_REF_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * A short, opaque, non-enumerable token for the /r/{shortRef} path (§H.2).
 * 10 base62 chars ≈ 59 bits — collisions are astronomically unlikely; the
 * unique index + retry in the adapter is the belt-and-suspenders guarantee.
 * `randomInt` is unbiased (rejection-sampled), unlike `% 62` on raw bytes.
 */
export function generateShortRef(length = 10): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SHORT_REF_ALPHABET[randomInt(SHORT_REF_ALPHABET.length)];
  }
  return out;
}
