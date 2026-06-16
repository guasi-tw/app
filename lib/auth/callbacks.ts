import type { NextAuthConfig } from "next-auth";

/** Google always sets email_verified; we verify rather than assume (spec §4). */
export function isGoogleEmailVerified(profile: unknown): boolean {
  return (
    typeof profile === "object" &&
    profile !== null &&
    (profile as { email_verified?: unknown }).email_verified === true
  );
}

/** Reject Google sign-in unless the Google email is verified; pass others through. */
export const signInCallback: NonNullable<NonNullable<NextAuthConfig["callbacks"]>["signIn"]> = async ({
  account,
  profile,
}) => {
  if (account?.provider === "google") {
    return isGoogleEmailVerified(profile);
  }
  return true;
};
