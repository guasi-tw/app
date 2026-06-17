"use client";

import { useState } from "react";
import type { AccountView } from "./types";
import { discloseAction, setMainAction, reportConditionAction } from "./actions";

type Panel = "disclose" | "main" | "hacked" | "banned" | null;

function ConfirmPanel({
  tone,
  message,
  confirmLabel,
  action,
  accountId,
  condition,
  onCancel,
}: {
  tone: "warn" | "danger";
  message: string;
  confirmLabel: string;
  action: (fd: FormData) => void;
  accountId: string;
  condition?: "hacked" | "banned";
  onCancel: () => void;
}) {
  return (
    <div className={`confirm-panel ${tone}`}>
      <p className="confirm-msg">{message}</p>
      <div className="confirm-row">
        <form action={action}>
          <input type="hidden" name="linkedAccountId" value={accountId} />
          {condition ? <input type="hidden" name="condition" value={condition} /> : null}
          <button type="submit" className="btn-primary sm">{confirmLabel}</button>
        </form>
        <button type="button" className="btn-secondary sm" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

/** §C management controls — inline-expand confirm (pattern A); no modal. */
export function ManageChips({ account }: { account: AccountView }) {
  const [panel, setPanel] = useState<Panel>(null);

  // Flagged rows: the only control is the scoped re-verify entry (§C.4).
  if (account.flagged) {
    return (
      <div className="acct-actions">
        <a className="chip recover" href={`/add/${account.platform}?recover=${encodeURIComponent(account.accountId)}`}>
          恢復 · 重新驗證 →
        </a>
      </div>
    );
  }

  const isPrivate = account.variant === "private";
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  return (
    <div className="acct-actions">
      {isPrivate ? (
        <button type="button" className="chip" onClick={() => toggle("disclose")}>🔒 設為公開（永久）</button>
      ) : (
        <span className="chip is-static">🔒 已公開（永久）</span>
      )}

      {account.variant !== "main" && (
        <button type="button" className="chip" onClick={() => toggle("main")}>★ 設為主要</button>
      )}

      <button type="button" className="chip" onClick={() => toggle("hacked")}>回報遭盜用</button>
      <button type="button" className="chip" onClick={() => toggle("banned")}>回報已被停權</button>

      {/* Panels are gated on their chip still being applicable, so a post-revalidate
          re-render (which moves the row to a new bucket) auto-collapses the panel. */}
      {isPrivate && panel === "disclose" && (
        <ConfirmPanel
          tone="warn"
          message="公開後將永久顯示在你的正身頁，無法再次隱藏。"
          confirmLabel="確認公開"
          action={discloseAction}
          accountId={account.id}
          onCancel={() => setPanel(null)}
        />
      )}
      {account.variant !== "main" && panel === "main" && (
        <ConfirmPanel
          tone="warn"
          message={
            isPrivate
              ? "設為主要會將此帳號永久公開，並成為你正身頁的代表帳號（★）。"
              : "將此帳號設為你正身頁的代表帳號（★）。"
          }
          confirmLabel="設為主要"
          action={setMainAction}
          accountId={account.id}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === "hacked" && (
        <ConfirmPanel
          tone="danger"
          message="將公開標記此帳號遭盜用，降低其信任。僅能透過重新驗證恢復。"
          confirmLabel="回報遭盜用"
          action={reportConditionAction}
          accountId={account.id}
          condition="hacked"
          onCancel={() => setPanel(null)}
        />
      )}
      {panel === "banned" && (
        <ConfirmPanel
          tone="danger"
          message="將公開標記此帳號已被停權，降低其信任。僅能透過重新驗證恢復。"
          confirmLabel="回報已被停權"
          action={reportConditionAction}
          accountId={account.id}
          condition="banned"
          onCancel={() => setPanel(null)}
        />
      )}
    </div>
  );
}
