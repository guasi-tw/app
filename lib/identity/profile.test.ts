import { describe, it, expect } from "vitest";
import {
  sanitizeDisplayName,
  sanitizeBio,
  DISPLAY_NAME_MAX,
  BIO_MAX,
  BIO_MAX_LINES,
} from "./profile";

describe("sanitizeDisplayName", () => {
  it("trims and accepts a normal name", () => {
    expect(sanitizeDisplayName("  Alice Wang  ")).toEqual({ ok: true, value: "Alice Wang" });
  });
  it("strips control chars (incl. newlines/tabs — names are single-line)", () => {
    expect(sanitizeDisplayName("Alice\tWang\n")).toEqual({ ok: true, value: "AliceWang" });
  });
  it("rejects an empty / whitespace-only name", () => {
    expect(sanitizeDisplayName("   ")).toEqual({ ok: false, error: "請輸入顯示名稱" });
  });
  it("rejects HTML markup", () => {
    expect(sanitizeDisplayName("<script>x</script>").ok).toBe(false);
  });
  it("rejects an over-length name", () => {
    expect(sanitizeDisplayName("a".repeat(DISPLAY_NAME_MAX + 1)).ok).toBe(false);
  });
  it("accepts exactly the max length", () => {
    expect(sanitizeDisplayName("a".repeat(DISPLAY_NAME_MAX)).ok).toBe(true);
  });
});

describe("sanitizeBio", () => {
  it("returns null for an empty bio (optional field)", () => {
    expect(sanitizeBio("")).toEqual({ ok: true, value: null });
  });
  it("keeps newlines but strips other control chars", () => {
    expect(sanitizeBio("line1\nline2 ")).toEqual({ ok: true, value: "line1\nline2" });
  });
  it("normalizes CRLF to LF and trims trailing spaces before newlines", () => {
    expect(sanitizeBio("a  \r\nb")).toEqual({ ok: true, value: "a\nb" });
  });
  it("rejects HTML markup", () => {
    expect(sanitizeBio("<b>hi</b>").ok).toBe(false);
  });
  it("rejects an over-length bio", () => {
    expect(sanitizeBio("a".repeat(BIO_MAX + 1)).ok).toBe(false);
  });
  it("accepts a bio up to the new 200-char max", () => {
    expect(sanitizeBio("a".repeat(200)).ok).toBe(true);
    expect(sanitizeBio("a".repeat(201)).ok).toBe(false);
  });
  it("collapses 3+ consecutive newlines down to a single blank-line separator", () => {
    expect(sanitizeBio("a\n\n\n\nb")).toEqual({ ok: true, value: "a\n\nb" });
  });
  it("allows up to 8 lines and rejects a 9th", () => {
    expect(sanitizeBio(Array.from({ length: 8 }, (_, i) => `l${i}`).join("\n")).ok).toBe(true);
    expect(sanitizeBio(Array.from({ length: 9 }, (_, i) => `l${i}`).join("\n")).ok).toBe(false);
  });
});
