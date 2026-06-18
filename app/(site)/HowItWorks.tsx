import { landingContent as c } from "./landing-content";
import styles from "./landing.module.css";

// The 3-step how-it-works block (建立正身 → 綁定分身 → 驗明正身) + the 正身/分身 gloss.
// Shared by the homepage and the about page so the steps can't drift.
export function HowItWorks() {
  return (
    <>
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
    </>
  );
}
