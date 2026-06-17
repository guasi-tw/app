// Shared site footer for the primary funnel pages. The 關於 link is the
// low-interruption, always-available entry point to /about — it sits in the
// footer so it never competes with a page's main action.
export function SiteFooter() {
  return (
    <footer className="foot">
      guasi.tw　·　<a href="/about">關於，我是什麼</a>
    </footer>
  );
}
