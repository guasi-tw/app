// Input-safety for the public 驗明正身 page (§B / §D.1): plain text only, capped.
// XSS defense is layered — these strip/reject on input AND React escapes on render.

export const DISPLAY_NAME_MAX = 50;
export const BIO_MAX = 160;

// C0/C1 control chars and DEL. For names we strip ALL of them (incl. \t \n).
const ALL_CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;
// For bios we keep \n (0A) but strip the rest, incl. \t and \r (handled separately).
const CONTROL_EXCEPT_LF = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;
// Conservative HTML-tag detector — rejects <script>, <b>, <img …> while allowing a lone "<".
const HTML_TAG = /<[a-z/!][^>]*>/i;

export type TextResult = { ok: true; value: string } | { ok: false; error: string };
export type BioResult = { ok: true; value: string | null } | { ok: false; error: string };

export function sanitizeDisplayName(raw: string): TextResult {
  const value = (raw ?? "").replace(ALL_CONTROL, "").trim();
  if (value.length === 0) return { ok: false, error: "請輸入顯示名稱" };
  if (HTML_TAG.test(value)) return { ok: false, error: "顯示名稱不可包含 HTML 標記" };
  if (value.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `顯示名稱不可超過 ${DISPLAY_NAME_MAX} 字` };
  }
  return { ok: true, value };
}

export function sanitizeBio(raw: string): BioResult {
  const value = (raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(CONTROL_EXCEPT_LF, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (value.length === 0) return { ok: true, value: null };
  if (HTML_TAG.test(value)) return { ok: false, error: "簡介不可包含 HTML 標記" };
  if (value.length > BIO_MAX) return { ok: false, error: `簡介不可超過 ${BIO_MAX} 字` };
  return { ok: true, value };
}
