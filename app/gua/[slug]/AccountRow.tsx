import type { AccountView } from "./types";

const VARIANT_CLASS: Record<AccountView["variant"], string> = {
  main: "acct-pill main",
  active: "acct-pill",
  flagged: "acct-pill flag",
  private: "acct-pill priv",
};

/** Stubbed (no-op) management chips — look final; Slice 5 wires them. */
function ManageChips({ account }: { account: AccountView }) {
  return (
    <div className="acct-actions">
      <button type="button" className="chip" disabled>
        {account.variant === "private" ? "🔒 設為公開（永久）" : "🔒 已公開（永久）"}
      </button>
      {!account.flagged && account.variant !== "main" && (
        <button type="button" className="chip" disabled>★ 設為主要</button>
      )}
      {account.flagged ? (
        <button type="button" className="chip" disabled>恢復 · 重新驗證 →</button>
      ) : (
        <button type="button" className="chip" disabled>回報遭盜用 / 停權</button>
      )}
    </div>
  );
}

export function AccountRow({
  account,
  manage = false,
}: {
  account: AccountView;
  manage?: boolean;
}) {
  const inner = (
    <>
      <div className="acct-row">
        <div className="acct-id">
          <span className="acct-handle">@{account.handle}</span>
          <span className="acct-meta">驗證於 {account.verifiedAt}</span>
        </div>
        {account.profileUrl && !manage && <span className="acct-out" aria-hidden>↗</span>}
      </div>
      {account.flagged && (
        <p className="acct-warn">⚠ 已回報遭盜用 · 此帳號已非本人</p>
      )}
      {manage && <ManageChips account={account} />}
    </>
  );

  // Public view: active rows are a click-out link; flagged rows are inert.
  if (!manage && account.profileUrl) {
    return (
      <a
        className={VARIANT_CLASS[account.variant]}
        href={account.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
      </a>
    );
  }

  return <div className={VARIANT_CLASS[account.variant]}>{inner}</div>;
}
