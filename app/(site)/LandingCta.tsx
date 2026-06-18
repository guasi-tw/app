import { GoogleSignInButton } from "@/app/GoogleSignInButton";
import { landingContent as c } from "./landing-content";
import { landingCtaModel } from "./landing-cta-model";
import styles from "./landing.module.css";

// Renders the landing CTA for the current auth state (see landingCtaModel).
export function LandingCta({
  user,
}: {
  user: { slug: string | null; shortRef: string } | null;
}) {
  const model = landingCtaModel(user);

  if (model.kind === "home") {
    return (
      <a className="btn-secondary" href={model.href}>
        前往我的正身頁 →
      </a>
    );
  }

  return (
    <>
      <GoogleSignInButton block />
      <div className={styles.ctaNote}>{c.cta.note}</div>
    </>
  );
}
