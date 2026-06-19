// lib/ua.ts
// Detect in-app (webview) browsers, where Google blocks OAuth ("disallowed_useragent",
// 403). A user who opens a verification post link inside Threads/Instagram lands in that
// app's built-in browser and CANNOT complete Google sign-in (or 切換帳號) — so we surface a
// nudge to reopen in a real browser.
//
// We match the contexts our users actually arrive from: Instagram and Threads (whose iOS
// webview UA carries the build codename "Barcelona"), the Facebook/Messenger family, LINE,
// and the generic Android WebView marker `; wv` (covers every other in-app browser on
// Android). Plain Chrome/Safari carry none of these tokens.
const IN_APP_BROWSER_RE = /(Instagram|Barcelona|FBAN|FBAV|FB_IAB|FBIOS|; ?wv\)|Line\/)/i;

export function isInAppBrowser(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return IN_APP_BROWSER_RE.test(userAgent);
}
