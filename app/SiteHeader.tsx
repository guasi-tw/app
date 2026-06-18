import { getCurrentUser } from "@/lib/identity/session";
import { ownerHomePath } from "@/lib/identity/urls";
import { AccountMenu } from "./AccountMenu";
import { googleSignInAction } from "./account-actions";

// Global top-bar. Conventional layout: top-left = icon + brand → home; top-right = context action —
// 登入/免費註冊 logged out, and a logged-in account menu (avatar → 正身頁面 / 切換帳號 / 登出).
export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="site-header">
      <a className="site-brand" href="/">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimization needed */}
        <img src="/guasi-avatar.svg" alt="" width={26} height={26} />
        <span>我是</span>
      </a>
      <nav className="site-actions">
        {user ? (
          <AccountMenu
            homeHref={ownerHomePath(user)}
            displayName={user.displayName ?? "我"}
            avatarUrl={user.avatarUrl ?? null}
          />
        ) : (
          // Go straight to Google's consent screen (no /login hop). Both create-or-sign-in via the
          // same OAuth flow; /post-login then routes new users to onboarding, returning users home.
          <>
            <form action={googleSignInAction}>
              <button type="submit" className="site-link">登入</button>
            </form>
            <form action={googleSignInAction}>
              <button type="submit" className="site-cta">使用 Google 免費註冊</button>
            </form>
          </>
        )}
      </nav>
    </header>
  );
}
