// lib/ua.test.ts
import { describe, it, expect } from "vitest";
import { isInAppBrowser } from "./ua";

describe("isInAppBrowser", () => {
  it("detects the Instagram in-app browser", () => {
    expect(
      isInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 339.0.0.30.105 (iPhone15,2; iOS 17_5)",
      ),
    ).toBe(true);
  });

  it("detects the Threads in-app browser (Barcelona codename)", () => {
    expect(
      isInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 339.0.0.30.105",
      ),
    ).toBe(true);
  });

  it("detects the Facebook family and LINE", () => {
    expect(isInAppBrowser("Mozilla/5.0 ... [FBAN/FBIOS;FBAV/123.0]")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 13) ... Line/14.0.0")).toBe(true);
  });

  it("detects the generic Android WebView marker", () => {
    expect(
      isInAppBrowser(
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36; wv)",
      ),
    ).toBe(true);
  });

  it("does NOT flag normal mobile Safari / Chrome", () => {
    expect(
      isInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
    expect(
      isInAppBrowser(
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(false);
  });

  it("is safe on missing user-agent", () => {
    expect(isInAppBrowser(null)).toBe(false);
    expect(isInAppBrowser(undefined)).toBe(false);
    expect(isInAppBrowser("")).toBe(false);
  });
});
