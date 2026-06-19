// Fixed top banner shown only when the request comes from an in-app (webview) browser
// (see lib/ua.ts). Google's OAuth rejects webviews, so sign-in / 切換帳號 silently fail there;
// this tells the user to reopen the page in a real browser. Static markup — no client JS.
export function InAppBrowserBanner() {
  return (
    <div className="inapp-banner" role="alert">
      <span>
        你正在 App 內建瀏覽器中，Google 登入會被擋下。請點右上角選單，選「使用外部瀏覽器開啟」（Safari／Chrome）。
      </span>
    </div>
  );
}
