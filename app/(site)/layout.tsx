import { headers } from "next/headers";
import { SiteHeader } from "@/app/SiteHeader";
import { SiteFooter } from "@/app/SiteFooter";
import { InAppBrowserBanner } from "@/app/InAppBrowserBanner";
import { isInAppBrowser } from "@/lib/ua";

// Shared chrome for every page under the (site) route group — home, about, add,
// onboarding, login, and the public Identity Card (/gua, /r). They all inherit the
// fixed header + footer automatically, so new pages get them for free. The header and
// footer are position:fixed, so page wrappers reserve top/bottom space for them via the
// --site-header-h / --site-footer-h custom properties (see globals.css).
//
// In-app (webview) browsers can't complete Google sign-in, so when we detect one we add a
// fixed top banner and reserve space for it via --inapp-banner-h (set by .has-inapp-banner),
// which pushes the header down and grows the content top-padding.
export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const inApp = isInAppBrowser((await headers()).get("user-agent"));
  return (
    <div className={inApp ? "site-shell has-inapp-banner" : "site-shell"}>
      {inApp && <InAppBrowserBanner />}
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
