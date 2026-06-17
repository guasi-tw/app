import { notFound } from "next/navigation";
import { findUserBySlug, listIdentityAccounts } from "@/lib/identity/repo";
import { getCurrentUser } from "@/lib/identity/session";
import { getAdapter } from "@/lib/binding/platforms";
import { SITE_ORIGIN } from "@/lib/binding/constants";
import { IdentityCard } from "./IdentityCard";
import type { AccountVariant, AccountView } from "./types";
import type { LinkedAccount } from "@prisma/client";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function toView(a: LinkedAccount, variant: AccountVariant): AccountView {
  const adapter = getAdapter(a.platform);
  const clickable = a.condition === "active";
  return {
    id: a.id,
    handle: a.handle,
    verifiedAt: fmtDate(a.verifiedAt),
    profileUrl: clickable ? adapter?.profileUrl(a.handle) ?? null : null,
    variant,
    flagged: a.condition !== "active",
  };
}

export default async function IdentityCardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Case-insensitive lookup via the citext slug column
  const user = await findUserBySlug(slug);
  if (!user) notFound();

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === user.id;

  const data = await listIdentityAccounts(user.id, { includePrivate: isOwner });

  const accounts = {
    main: data.main ? toView(data.main, "main") : null,
    active: data.active.map((a) => toView(a, "active")),
    flagged: data.flagged.map((a) => toView(a, "flagged")),
    private: data.privateAccounts.map((a) => toView(a, "private")),
  };

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
      count={data.count}
      isOwner={isOwner}
      publicUrl={`${SITE_ORIGIN}/gua/${slug}`}
      viewerLoggedIn={!!viewer}
      ownerHomeUrl={ownerHomeUrl}
      accounts={accounts}
    />
  );
}
