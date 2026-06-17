import Google from "next-auth/providers/google";

// MVP: Google is the only login method. Email (magic-link/OTP) is a deferred,
// additive provider — see docs/email-login-design.md.
//
// `prompt: "select_account"` forces Google's account chooser on every login so the
// 切換帳號 flow works — without it Google can silently re-pick the last account.
// One Google account = one 正身 (User keyed by unique email).
export const providers = [
  Google({
    authorization: { params: { prompt: "select_account" } },
  }),
];
