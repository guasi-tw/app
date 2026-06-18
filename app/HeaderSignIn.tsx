"use client";

import { usePathname } from "next/navigation";
import { GoogleSignInButton } from "./GoogleSignInButton";

// The global header's sign-in button, hidden on the homepage `/` — there the hero and
// closing CTAs already provide the login action, so a third identical button stacked in
// the first viewport is redundant. Shown on every other page, where the header is the
// main login entry.
export function HeaderSignIn() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <GoogleSignInButton />;
}
