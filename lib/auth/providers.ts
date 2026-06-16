import Google from "next-auth/providers/google";

// MVP: Google is the only login method. Email (magic-link/OTP) is a deferred,
// additive provider — see 2026-06-15-email-login-future-feature.md.
export const providers = [Google];
