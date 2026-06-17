import type { AccountView } from "./types";
import { PlatformIcon } from "./PlatformIcon";
import { ManageChips } from "./ManageChips";

const VARIANT_CLASS: Record<AccountView["variant"], string> = {
  main: "acct-pill main",
  active: "acct-pill",
  flagged: "acct-pill flag",
  private: "acct-pill priv",
};

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
          <span className="acct-name-line">
            <span className="acct-handle">@{account.handle}</span>
            {account.variant === "main" && (
              <span className="acct-main-tag">★ 主要</span>
            )}
          </span>
          <span className="acct-meta">
            <span className="acct-plat">
              <PlatformIcon platform={account.platform} />
              {account.platformLabel}
            </span>
            {" · 驗證於 "}
            {account.verifiedAt}
          </span>
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
