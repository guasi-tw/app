import { SiteHeader } from "@/app/SiteHeader";
import { SiteFooter } from "@/app/SiteFooter";

// Shared chrome for every page under the (site) route group — home, about, add,
// onboarding, login, and the public Identity Card (/gua, /r). They all inherit the
// fixed header + footer automatically, so new pages get them for free. The header and
// footer are position:fixed, so page wrappers reserve top/bottom space for them via the
// --site-header-h / --site-footer-h custom properties (see globals.css).
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
