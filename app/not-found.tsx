import { SiteFooter } from "@/app/SiteFooter";
import { SiteHeader } from "@/app/SiteHeader";

export default function NotFound() {
  return (
    <main className="wrap">
      <SiteHeader />
      <h1 className="wordmark">404</h1>
      <p className="lede">找不到這個頁面。</p>
      <p className="status">
        <a href="/">回首頁</a>
      </p>
      <SiteFooter />
    </main>
  );
}
