"use client";

import { useEffect, useRef, useState } from "react";
import { signOutAction, switchAccountAction } from "./account-actions";

// Global account control (top-right of the site header). The avatar button opens a small menu so
// 登出 / 切換帳號 are reachable from every page. `homeHref` points at the owner's own 正身 page.
export function AccountMenu({
  homeHref,
  displayName,
  avatarUrl,
}: {
  homeHref: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="acct-menu" ref={ref}>
      <button
        type="button"
        className="acct-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="帳號選單"
        onClick={() => setOpen((v) => !v)}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- small remote avatar, no optimization needed
          <img className="acct-menu-avatar" src={avatarUrl} alt="" />
        ) : (
          <span className="acct-menu-avatar placeholder" aria-hidden>
            {displayName.slice(0, 1)}
          </span>
        )}
        <span className="acct-menu-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="acct-menu-pop" role="menu">
          <a className="acct-menu-item" role="menuitem" href={homeHref}>
            正身頁面
          </a>
          <form action={switchAccountAction}>
            <button type="submit" className="acct-menu-item" role="menuitem">
              切換帳號
            </button>
          </form>
          <form action={signOutAction}>
            <button type="submit" className="acct-menu-item danger" role="menuitem">
              登出
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
