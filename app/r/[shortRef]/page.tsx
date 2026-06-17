import { permanentRedirect, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { findUserByShortRef } from "@/lib/identity/repo";
import { IdentityCard } from "@/app/gua/[slug]/IdentityCard";
import { buildAccountGroups } from "@/app/gua/[slug]/accounts";

export default async function ShortRefPage({
  params,
}: {
  params: Promise<{ shortRef: string }>;
}) {
  const { shortRef } = await params;

  const owner = await findUserByShortRef(shortRef);
  // Unknown short-ref → main page.
  if (!owner) redirect("/");

  const viewer = await getCurrentUser();
  const isOwner = !!viewer && viewer.id === owner.id;

  if (owner.slug) {
    // Public page exists. Owner lands on the management tab; everyone else sees the public card.
    if (isOwner) redirect(`/gua/${owner.slug}?view=manage`);
    permanentRedirect(`/gua/${owner.slug}`);
  }

  // No public slug yet — there is no public page, so only the owner has anything to see.
  if (!isOwner) redirect("/"); // logged out, or not the owner → main page

  // Owner without a slug: render the management tab inline, locked (can't switch to a
  // public view that doesn't exist yet). The add button mints the slug via the main binding.
  const { accounts, count } = await buildAccountGroups(owner.id, true);

  return (
    <IdentityCard
      displayName={owner.displayName ?? "（未命名）"}
      bio={owner.bio}
      avatarUrl={owner.avatarUrl}
      count={count}
      isOwner
      publicUrl={null}
      viewerLoggedIn
      ownerHomeUrl={null}
      accounts={accounts}
      lockManage
    />
  );
}
