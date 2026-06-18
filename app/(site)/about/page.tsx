import type { Metadata } from "next";
import { aboutContent as c } from "./content";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "關於 guasi · 我是正身",
  description:
    "帳號被封時，怎麼證明「這真的是我」？guasi（我是）讓你趁帳號還活著，事先驗證並串連各平台帳號，被封後存活的帳號能替你背書。",
};

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {/* 1 hook */}
        <section className={styles.section}>
          <h1 className={styles.hookTitle}>{c.hook.title}</h1>
          <p className={styles.body}>{c.hook.body}</p>
        </section>

        {/* 2 brand answer */}
        <section className={`${styles.section} ${styles.gold} ${styles.center}`}>
          <div className={styles.kicker}>{c.brand.kicker}</div>
          <div className={styles.wordmark}>{c.brand.wordmark}</div>
          <div className={styles.pron}>{c.brand.pronunciation}</div>
          <p className={styles.body}>{c.brand.body}</p>
        </section>

        {/* 3 how it works + example post */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{c.how.title}</h2>
          <p className={styles.body}>{c.how.body}</p>
          <p className={styles.gloss}>{c.how.gloss}</p>

          <div className={styles.steps}>
            {c.how.steps.map((s) => (
              <div className={styles.step} key={s.n}>
                <div className={styles.stepNum}>{s.n}</div>
                <div className={styles.stepText}>
                  <strong className={styles.strong}>{s.title}</strong>　{s.body}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.post}>
            <span className={styles.badge}>{c.examplePost.badge}</span>
            <div className={styles.postHead}>
              <div className={styles.postAvatar} />
              <div className={styles.postAuthor}>
                {c.examplePost.author}{" "}
                <span className={styles.postTime}>· {c.examplePost.time}</span>
              </div>
            </div>
            <div className={styles.postBody}>
              <div className={styles.link}>{c.examplePost.tag}</div>
              <div>{c.examplePost.headline}</div>
              <div className={styles.gap}>{c.examplePost.linkIntro}</div>
              <div className={styles.link}>{c.examplePost.shortUrl}</div>
              <div className={styles.gap}>
                {c.examplePost.codeLabel}
                <strong className={styles.strong}>{c.examplePost.code}</strong>
              </div>
            </div>
            <div className={styles.preview}>
              <div className={styles.previewDomain}>{c.examplePost.previewDomain}</div>
              <div className={styles.previewTitle}>{c.examplePost.previewTitle}</div>
            </div>
            <p className={styles.postCaption}>{c.examplePost.caption}</p>
          </div>
        </section>

        {/* platforms */}
        <section className={styles.section}>
          <div className={styles.plabel}>{c.platforms.label}</div>
          <div className={styles.chips}>
            {c.platforms.items.map((p) => (
              <span className={styles.chip} key={p}>
                {p}
              </span>
            ))}
            <span className={styles.chipMore}>{c.platforms.more}</span>
          </div>
        </section>

        {/* platform independence */}
        <section className={`${styles.section} ${styles.gold}`}>
          <div className={styles.kicker}>{c.independence.kicker}</div>
          <h2 className={styles.h2}>{c.independence.title}</h2>
          <p className={styles.body}>{c.independence.body}</p>
        </section>

        {/* 4 example profile card */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{c.exampleProfile.sectionTitle}</h2>
          <p className={styles.sectionDesc}>{c.exampleProfile.sectionDesc}</p>

          <div className={styles.card}>
            <span className={styles.badge}>{c.exampleProfile.badge}</span>
            <div className={styles.cardHead}>
              <div className={styles.avatar} aria-hidden="true">{c.exampleProfile.avatarInitial}</div>
              <div className={styles.pname}>{c.exampleProfile.name}</div>
              <div className={styles.purl}>{c.exampleProfile.handleUrl}</div>
              <span className={styles.pcount}>{c.exampleProfile.count}</span>
            </div>
            <div className={styles.tabbar}>
              <span className={styles.tabActive}>{c.exampleProfile.tabs.accounts}</span>
              <span className={styles.tab}>{c.exampleProfile.tabs.timeline}</span>
            </div>
            <div className={styles.accounts}>
              <p className={styles.guarantee}>{c.exampleProfile.guarantee}</p>
              {c.exampleProfile.accounts.map((a) => (
                <div className={styles.account} key={a.handle}>
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
          <p className={styles.cardCaption}>{c.exampleProfile.shareCaption}</p>
        </section>

        {/* 5 why trustworthy */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{c.trust.title}</h2>
          <div className={styles.trustList}>
            {c.trust.items.map((t) => (
              <div key={t.title}>
                <span aria-hidden="true">✔</span>　<strong className={styles.strong}>{t.title}</strong>——{t.body}
              </div>
            ))}
          </div>
        </section>

        {/* 6 why now */}
        <section className={styles.section}>
          <h2 className={styles.h2}>{c.whyNow.title}</h2>
          <p className={styles.body}>{c.whyNow.body}</p>
        </section>

        {/* 7 CTA */}
        <section className={`${styles.section} ${styles.gold} ${styles.center}`}>
          <h2 className={styles.ctaTitle}>{c.cta.title}</h2>
          <p className={styles.ctaSub}>{c.cta.subtitle}</p>
          <a className={styles.ctaButton} href={c.cta.href}>
            {c.cta.buttonLabel}
          </a>
          <div className={styles.ctaNote}>{c.cta.note}</div>
        </section>

        <div className={styles.contact}>
          {c.contact.label}{" "}
          <a className={styles.contactLink} href={`mailto:${c.contact.email}`}>
            {c.contact.email}
          </a>
        </div>
      </div>
    </main>
  );
}
