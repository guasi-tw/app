import { landingContent as c } from "./landing-content";
import styles from "./landing.module.css";

// The mock 驗明正身 card (a sample public identity card). Shared by the about page
// (illustrative, with the share caption) and the homepage (with a link through to a
// real card). `withLiveLink` swaps the caption for the 看一個真實的正身 → button.
export function ExampleCard({ withLiveLink = false }: { withLiveLink?: boolean }) {
  const p = c.exampleProfile;
  return (
    <>
      <h2 className={styles.h2}>{p.sectionTitle}</h2>
      <p className={styles.sectionDesc}>{p.sectionDesc}</p>

      <div className={styles.card}>
        <span className={styles.badge}>{p.badge}</span>
        <div className={styles.cardHead}>
          <div className={styles.avatar} aria-hidden="true">{p.avatarInitial}</div>
          <div className={styles.pname}>{p.name}</div>
          <p className={styles.pbio}>{p.bio}</p>
          <span className={styles.pcount}>{p.count}</span>
        </div>
        <div className={styles.tabbar}>
          <span className={styles.tabActive}>{p.tabs.accounts}</span>
          <span className={styles.tab}>{p.tabs.timeline}</span>
        </div>
        <div className={styles.accounts}>
          <p className={styles.guarantee}>{p.guarantee}</p>
          {p.accounts.map((a) => (
            <div className={styles.account} key={`${a.platform}-${a.handle}`}>
              <div className={styles.acctId}>
                <span className={styles.acctNameLine}>
                  <span className={styles.acctHandle}>{a.handle}</span>
                  {a.main && <span className={styles.acctMain}>★ 主要</span>}
                </span>
                <span className={styles.acctMeta}>
                  {a.platform} · {a.verified}
                </span>
              </div>
              <span className={styles.acctOut} aria-hidden="true">↗</span>
            </div>
          ))}
        </div>
      </div>

      {withLiveLink ? (
        <a className="btn-secondary" href={p.liveLink.href}>
          {p.liveLink.label}
        </a>
      ) : (
        <p className={styles.cardCaption}>{p.shareCaption}</p>
      )}
    </>
  );
}
