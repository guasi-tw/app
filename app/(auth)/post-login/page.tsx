import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";

/**
 * Post-login dispatcher. A static `redirectTo` on the Google button can't choose the
 * destination because the 正身's state isn't known until the session exists, so signIn
 * lands here and we branch on it:
 *   - provisioned 正身 (has a slug) → their public profile page `/gua/{slug}`
 *   - slug-less but already onboarded (returning, no main yet) → their `/r/{shortRef}` card
 *   - genuine first-timer (no slug, no `onboardedAt`) → `/onboarding`
 * `slug` is the codebase's "this account is provisioned" signal (minted at main-account
 * designation); `onboardedAt` (§F) distinguishes a returning unprovisioned user from a
 * brand-new one, so the latter no longer dumps returning users back into the wizard.
 */
export default async function PostLoginPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  else if (user.slug) redirect(`/gua/${user.slug}`);
  else if (user.onboardedAt) redirect(`/r/${user.shortRef}`); // pre-provisioned card, not the wizard
  else redirect("/onboarding"); // genuine first-timer
}
