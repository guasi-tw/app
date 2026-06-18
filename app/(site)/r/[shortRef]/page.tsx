import { permanentRedirect, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity/session";
import { findUserByShortRef } from "@/lib/identity/repo";
import { IdentityCard } from "@/app/(site)/gua/[slug]/IdentityCard";
import { buildAccountGroups } from "@/app/(site)/gua/[slug]/accounts";

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
    // Public page exists — everyone (owner included) lands on the public card.
    // The owner can switch to 管理檢視 from there.
    if (isOwner) redirect(`/gua/${owner.slug}`);
    permanentRedirect(`/gua/${owner.slug}`);
  }

  // No public slug yet — there is no public page, so only the owner has anything to see.
  if (!isOwner) redirect("/"); // logged out, or not the owner → main page

  // Owner without a slug: render the management tab inline, locked (can't switch to a
  // public view that doesn't exist yet). The add button mints the slug via the main binding.
  const { accounts, count, mainFlagged } = await buildAccountGroups(owner.id, true);

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
      mainFlagged={mainFlagged}
      lockManage
    />
  );
}
