/**
 * Where a logged-in owner's "my 正身" link should point: the public card once a slug
 * exists (minted at main-account verification), else the always-resolvable short link
 * (/r/{shortRef} renders the management card inline for a slug-less owner). Linking
 * straight to /gua/{slug} skips /r's redirect hop for verified owners.
 *
 * NOTE: distinct from /post-login, which sends a *brand-new* (profile-less) 正身 to
 * /onboarding for first-run profile setup — that funnel doesn't apply to an already
 * established owner navigating back to their own page.
 */
export function ownerHomePath(user: { slug: string | null; shortRef: string }) {
  return user.slug ? `/gua/${user.slug}` : `/r/${user.shortRef}`;
}
