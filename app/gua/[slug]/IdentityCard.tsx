"use client";

import { useState } from "react";
import type { AccountGroups } from "./types";
import { AccountRow } from "./AccountRow";
import { ShareLink } from "./ShareLink";
import { signOutAction, switchAccountAction } from "./actions";

type Props = {
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  count: number;
  isOwner: boolean;
  publicUrl: string;
  viewerLoggedIn: boolean;
  ownerHomeUrl: string | null;
  accounts: AccountGroups;
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
}: Props) {
  const [mode, setMode] = useState<"public" | "manage">("public");
  const [tab, setTab] = useState<"accounts" | "timeline">("accounts");
  const manage = isOwner && mode === "manage";

  return (
    <main className="idcard">
      <header className="id-header">
        {avatarUrl && <img className="id-avatar" src={avatarUrl} alt="" />}
        <h1 className="id-name">{displayName}</h1>
        {bio && <p className="id-bio">{bio}</p>}
        <span className="id-badge">{count} 個分身</span>
        {isOwner && (
          <div className="id-toggle">
            <button
              type="button"
              className={mode === "public" ? "active" : ""}
              onClick={() => setMode("public")}
            >
              公開檢視
            </button>
            <button
              type="button"
              className={mode === "manage" ? "active" : ""}
              onClick={() => setMode("manage")}
            >
              管理檢視
            </button>
          </div>
        )}
      </header>

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
        <p className="id-bio" style={{ textAlign: "center" }}>時間軸施工中（Slice 4）。</p>
      ) : (
        <>
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
              <a className="btn-secondary" href="/add">＋ 註冊分身</a>
              <button type="button" className="btn-secondary" disabled>編輯個人資料</button>
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
        <ShareLink url={publicUrl} />
        {viewerLoggedIn ? (
          <a href={ownerHomeUrl ?? "/"}>前往你的正身 →</a>
        ) : (
          <a href="/login">建立你的正身 →</a>
        )}
      </footer>
    </main>
  );
}
