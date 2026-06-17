import { getCurrentUser } from "@/lib/identity/session";

// Global top-bar for the app/funnel pages (NOT the public Identity Card, which has
// its own profile chrome). Conventional layout: top-left = icon + brand → home;
// top-right = a single context action (登入/免費註冊 logged out, 我的正身 logged in).
export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="site-header">
      <a className="site-brand" href="/">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimization needed */}
        <img src="/guasi-avatar.svg" alt="" width={26} height={26} />
        <span>我是</span>
      </a>
      {/* 我的正身: once a main 分身 is verified the slug exists → link straight to the
          public card (skips the /r redirect hop). Slug-less owners fall back to
          /r/{shortRef}, which always resolves (renders the management card inline). */}
      <nav className="site-actions">
        {user ? (
          <a
            className="site-cta-ghost"
            href={user.slug ? `/gua/${user.slug}` : `/r/${user.shortRef}`}
          >
            我的正身
          </a>
        ) : (
          <>
            <a className="site-link" href="/login">
              登入
            </a>
            <a className="site-cta" href="/login">
              免費註冊
            </a>
          </>
        )}
      </nav>
    </header>
  );
}
