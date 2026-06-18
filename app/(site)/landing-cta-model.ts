import { ownerHomePath } from "@/lib/identity/urls";

// The landing-page CTA depends only on auth state: a logged-out visitor gets the
// Google sign-in button; a logged-in owner gets a link to their own 正身. The model
// is pure so the branch is unit-tested without rendering.
export type LandingCtaModel =
  | { kind: "signin" }
  | { kind: "home"; href: string };

export function landingCtaModel(
  user: { slug: string | null; shortRef: string } | null,
): LandingCtaModel {
  return user
    ? { kind: "home", href: ownerHomePath(user) }
    : { kind: "signin" };
}
