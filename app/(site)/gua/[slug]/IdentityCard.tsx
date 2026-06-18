"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { AccountGroups } from "./types";
import { AccountRow } from "./AccountRow";
import { TimelineList } from "./TimelineList";
import type { TimelineView } from "./timeline";
import { ShareLink } from "./ShareLink";
import { signOutAction, switchAccountAction } from "./actions";

type Props = {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  count: number;
  isOwner: boolean;
  /** Public identity-card URL, or null when not yet public (slug-less owner). */
  publicUrl: string | null;
  viewerLoggedIn: boolean;
  ownerHomeUrl: string | null;
  accounts: AccountGroups;
  /** Append-only ledger rows, oldest-first (genesis at index 0). */
  timeline: TimelineView[];
  /** The designated main 分身 is currently flagged (banned/hacked) → no featured main; nudge the owner. */
  mainFlagged?: boolean;
  /** Start in 管理檢視 instead of 公開檢視 (owner only). */
  initialManage?: boolean;
  /** Lock to 管理檢視 and hide the public/manage toggle (slug-less owner — no public page exists). */
  lockManage?: boolean;
};

export function IdentityCard({
  displayName,
  bio,
  avatarUrl,
  count,
  isOwner,
  publicUrl,
  viewerLoggedIn,
  ownerHomeUrl,
  accounts,
  timeline,
  mainFlagged = false,
  initialManage = false,
  lockManage = false,
}: Props) {
  const pathname = usePathname();
  const [mode, setMode] = useState<"public" | "manage">(
    lockManage || initialManage ? "manage" : "public",
  );
  const [tab, setTab] = useState<"accounts" | "timeline">("accounts");
  const manage = isOwner && (lockManage || mode === "manage");

  // Keep the URL in sync with the active view (manage ⇒ ?view=manage, public ⇒ clean path)
  // without a navigation — the component owns the view state client-side.
  function selectMode(next: "public" | "manage") {
    setMode(next);
    setTab("accounts"); // switching view always lands back on the 帳號 tab
    const url = next === "manage" ? `${pathname}?view=manage` : pathname;
    window.history.replaceState(null, "", url);
  }

  return (
    <main className="idcard">
      <header className="id-header">
        {isOwner && !lockManage && (
          // An on/off switch (not a two-tab control), pinned at the very top above the avatar:
          // off = 公開檢視, on = 管理模式.
          <div className="id-switch">
            <span className="id-switch-label">管理模式</span>
            <button
              type="button"
              role="switch"
              aria-checked={mode === "manage"}
              aria-label="管理模式"
              className={mode === "manage" ? "switch on" : "switch"}
              onClick={() => selectMode(mode === "manage" ? "public" : "manage")}
            >
              <span className="knob" aria-hidden />
            </button>
          </div>
        )}
        {avatarUrl && <img className="id-avatar" src={avatarUrl} alt="" />}
        <h1 className="id-name">{displayName}</h1>
        {bio && <p className="id-bio">{bio}</p>}
        {manage && (
          <a className="btn-secondary sm" href="/settings">編輯個人資料</a>
        )}
        <span className="id-badge">{count} 個分身</span>
        {lockManage && (
          <div className="banner">🔒 你的正身頁尚未公開（只有你看得到）</div>
        )}
      </header>

      {publicUrl && (
        // Share CTA — the guasi.tw/gua/{slug} link is the user's cross-platform 正身 profile, meant to
        // be pasted into other platforms' bios. Pinned up here (under the profile, above the tabs) so
        // it's actually reachable. Shown to everyone viewing a public 正身, not just the owner.
        <section className="id-share">
          <p className="id-share-cap">分享連結，讓大家能驗明正身。</p>
          <ShareLink url={publicUrl} />
        </section>
      )}

      <nav className="tabbar">
        <button
          type="button"
          className={tab === "accounts" ? "tab active" : "tab"}
          onClick={() => setTab("accounts")}
        >
          帳號
        </button>
        <button
          type="button"
          className={tab === "timeline" ? "tab active" : "tab"}
          onClick={() => setTab("timeline")}
        >
          時間軸
        </button>
      </nav>

      {tab === "timeline" ? (
        <TimelineList entries={timeline} manage={manage} />
      ) : (
        <>
          {!manage && (
            <p className="id-hint">
              ✓ 以下帳號皆經 guasi 確認屬於同一人，由本人公開貼文驗證。
            </p>
          )}
          {manage && mainFlagged && (
            <div className="banner warn">
              ⚠ 你的主要帳號已被停用，目前沒有代表帳號。請在下方「恢復·重新驗證」原帳號，或將其他帳號「設為主要」。
            </div>
          )}
          {manage && (
            // Add a new 分身 — sits at the top, above the main account.
            <a className="btn-secondary id-add-account" href="/add">
              {lockManage ? "＋ 驗證主要帳號" : "＋ 註冊分身"}
            </a>
          )}
          <div className="acct-list">
            {accounts.main && <AccountRow account={accounts.main} manage={manage} />}
            {accounts.active.map((a) => (
              <AccountRow key={a.id} account={a} manage={manage} />
            ))}
            {manage &&
              accounts.private.map((a) => (
                <AccountRow key={a.id} account={a} manage />
              ))}
            {accounts.flagged.map((a) => (
              <AccountRow key={a.id} account={a} manage={manage} />
            ))}
          </div>

          {manage && (
            <div className="id-manage-links">
              <form action={signOutAction}>
                <button type="submit" className="btn-secondary" style={{ width: "100%" }}>登出</button>
              </form>
              <form action={switchAccountAction}>
                <button type="submit" className="btn-secondary" style={{ width: "100%" }}>切換帳號</button>
              </form>
            </div>
          )}
        </>
      )}

      <footer className="id-foot">
        {/* The owner is already on their own 正身 — no self-referential link. */}
        {!isOwner &&
          (viewerLoggedIn ? (
            <a href={ownerHomeUrl ?? "/"}>前往你的正身 →</a>
          ) : (
            <a href="/login">建立你的正身 →</a>
          ))}
      </footer>
    </main>
  );
}
