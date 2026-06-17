import { notFound, redirect } from "next/navigation";
import { findUserBySlug } from "@/lib/identity/repo";
import { getCurrentUser } from "@/lib/identity/session";
import { SITE_ORIGIN } from "@/lib/binding/constants";
import { IdentityCard } from "./IdentityCard";
import { buildAccountGroups } from "./accounts";

export default async function IdentityCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { slug } = await params;
  const { view } = await searchParams;

  // Case-insensitive lookup via the citext slug column
  const user = await findUserBySlug(slug);
  if (!user) notFound();

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === user.id;

  // 管理檢視 is owner-only — a non-owner (or logged-out) viewer can't manage this
  // page, so strip ?view=manage and send them to the clean public URL.
  if (view === "manage" && !isOwner) redirect(`/gua/${slug}`);

  const { accounts, count } = await buildAccountGroups(user.id, isOwner);

  // Growth footer destination for a logged-in viewer → their own page.
  const ownerHomeUrl = viewer
    ? viewer.slug
      ? `/gua/${viewer.slug}`
      : `/r/${viewer.shortRef}`
    : null;

  return (
    <IdentityCard
      displayName={user.displayName ?? slug}
      bio={user.bio}
      avatarUrl={user.avatarUrl}
      count={count}
      isOwner={isOwner}
      publicUrl={`${SITE_ORIGIN}/gua/${slug}`}
      viewerLoggedIn={!!viewer}
      ownerHomeUrl={ownerHomeUrl}
      accounts={accounts}
      initialManage={isOwner && view === "manage"}
    />
  );
}
