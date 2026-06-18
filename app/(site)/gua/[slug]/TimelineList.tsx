import type { TimelineView } from "./timeline";
import { PlatformIcon } from "./PlatformIcon";

/** Row label per event kind (繁體中文 / Taiwan). Genesis is the synthetic anchor. */
const KIND_LABEL: Record<TimelineView["kind"], string> = {
  genesis: "建立正身",
  bound: "綁定",
  disclosed: "設為公開",
  set_main: "設為主要",
  reported_hacked: "本人回報遭盜用",
  reported_banned: "本人回報已被停權",
  re_verified: "重新驗證",
  unbound: "解除綁定",
};

/** Per-kind modifier class: gold (genesis/proof), red (flag), or plain. */
function kindClass(kind: TimelineView["kind"]): string {
  if (kind === "genesis") return "genesis";
  if (kind === "bound" || kind === "re_verified") return "proof";
  if (kind === "reported_banned" || kind === "reported_hacked") return "flag";
  return "";
}

export function TimelineList({
  entries,
  manage,
}: {
  entries: TimelineView[];
  manage: boolean;
}) {
  // 公開檢視 hides private entries; 管理檢視 shows all (private marked 私密).
  // For a non-owner the server never sent private entries — both projections are safe.
  const visible = manage ? entries : entries.filter((e) => !e.isPrivate);

  if (visible.length === 0) {
    return <p className="tl-empty">尚無時間軸記錄。</p>;
  }

  return (
    <ol className="timeline">
      {visible.map((e) => {
        const flag = e.kind === "reported_banned" || e.kind === "reported_hacked";
        const priv = manage && e.isPrivate;
        const cls = ["tl-item", kindClass(e.kind), priv ? "priv" : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <li key={e.id} className={cls}>
            <span className="dot" aria-hidden />
            <div className="tl-body">
              <div className="tl-date">{e.date}</div>
              <div className="tl-action">
                {flag && "⚠ "}
                {KIND_LABEL[e.kind]}
              </div>
              {e.handle && (
                <div className="tl-acct">
                  <span className="hd">@{e.handle}</span>
                  {e.platform && <PlatformIcon platform={e.platform} size={17} />}
                  {e.platformLabel && <span className="pl">{e.platformLabel}</span>}
                  {priv && <span className="tl-priv-tag">👁 私密</span>}
                </div>
              )}
              {e.proofPostUrl && (
                <a
                  className="tl-proof"
                  href={e.proofPostUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  查看貼文 ↗
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
