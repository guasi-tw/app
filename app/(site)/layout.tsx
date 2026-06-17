import { SiteHeader } from "@/app/SiteHeader";
import { SiteFooter } from "@/app/SiteFooter";

// Shared chrome for the app/funnel pages (home, about, add, onboarding, login).
// Anything placed under this (site) route group inherits the header + footer
// automatically — new pages get them for free, no per-page wiring.
// The public Identity Card (/gua, /r) lives OUTSIDE this group on purpose, so it
// keeps its own standalone profile chrome.
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
