"use server";

import { signIn, signOut } from "@/lib/auth";

// Account-level actions used by the global header's account menu (and anywhere else that needs
// them). Kept app-wide rather than under a single page, since they're not page-specific.

/**
 * Start Google OAuth straight away → land on the post-login dispatcher. Lets the header's
 * 登入 / 免費註冊 buttons go directly to Google's consent screen, skipping the /login hop. (/login
 * stays as the home for a future multi-method picker, e.g. when email login ships.)
 */
export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/post-login" });
}

/** 登出 → back to Home, logged out. */
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/**
 * 切換帳號 → drop the current session (no redirect), then go straight to Google's
 * account chooser — forced by the provider's prompt=select_account — so the user picks a
 * different account in one click, skipping the /login hop. Lands on /post-login after.
 */
export async function switchAccountAction() {
  await signOut({ redirect: false });
  await signIn("google", { redirectTo: "/post-login" });
}
