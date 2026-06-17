// lib/binding/code.ts
import { randomInt } from "node:crypto";
import { CODE_LABEL } from "./constants";

/**
 * A scoped, single-use 6-digit code (§6.2). Security comes from author-match + scope +
 * expiry, NOT entropy — so 6 digits (incl. leading zeros) is plenty. `randomInt` is
 * unbiased (rejection-sampled). `padStart` keeps small numbers 6 chars wide.
 */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** True iff `text` contains the namespaced label immediately followed by exactly `code` (§D.2.1). */
export function textHasCode(text: string, code: string): boolean {
  // Label, optional whitespace, then the exact code as a standalone digit run.
  const escapedLabel = CODE_LABEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escapedLabel}\\s*${escapedCode}(?!\\d)`);
  return re.test(text);
}
