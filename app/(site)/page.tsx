import { getCurrentUser } from "@/lib/identity/session";
import { landingContent as c } from "./landing-content";
import styles from "./landing.module.css";
import { HowItWorks } from "./HowItWorks";
import { ExampleCard } from "./ExampleCard";
import { LandingCta } from "./LandingCta";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {/* hero: problem hook + one-line value prop + CTA */}
        <section className={`${styles.section} ${styles.center}`}>
          <h1 className={styles.hookTitle}>{c.hook.title}</h1>
          <p className={styles.body}>{c.brand.body}</p>
          <LandingCta user={user} />
        </section>

        {/* how it works */}
        <section className={styles.section}>
          <HowItWorks />
        </section>

        {/* live demo card */}
        <section className={styles.section}>
          <ExampleCard withLiveLink />
        </section>

        {/* closing CTA */}
        <section className={`${styles.section} ${styles.gold} ${styles.center}`}>
          <h2 className={styles.ctaTitle}>{c.cta.title}</h2>
          <p className={styles.ctaSub}>{c.cta.subtitle}</p>
          <LandingCta user={user} />
        </section>
      </div>
    </main>
  );
}
