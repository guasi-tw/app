"use server";

import { signOut } from "@/lib/auth";

// Account-level actions used by the global header's account menu (and anywhere else that needs
// them). Kept app-wide rather than under a single page, since they're not page-specific.

/** 登出 → back to Home, logged out. */
export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/**
 * 切換帳號 → sign out then land on /login, where Google's chooser (forced by
 * prompt=select_account) lets the user pick a different account.
 */
export async function switchAccountAction() {
  await signOut({ redirectTo: "/login" });
}
