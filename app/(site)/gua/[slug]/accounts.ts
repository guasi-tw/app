import { listIdentityAccounts } from "@/lib/identity/repo";
import { getAdapter } from "@/lib/binding/platforms";
import type { AccountGroups, AccountVariant, AccountView } from "./types";
import type { LinkedAccount } from "@prisma/client";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function toView(a: LinkedAccount, variant: AccountVariant): AccountView {
  const adapter = getAdapter(a.platform);
  const clickable = a.condition === "active";
  return {
    id: a.id,
    accountId: a.accountId,
    handle: a.handle,
    platform: a.platform,
    platformLabel: adapter?.label ?? a.platform,
    verifiedAt: fmtDate(a.verifiedAt),
    profileUrl: clickable ? adapter?.profileUrl(a.handle) ?? null : null,
    variant,
    flagged: a.condition !== "active",
  };
}

/** Load a user's bound accounts grouped into the four render buckets the card expects. */
export async function buildAccountGroups(
  userId: string,
  isOwner: boolean,
): Promise<{ accounts: AccountGroups; count: number }> {
  const data = await listIdentityAccounts(userId, { includePrivate: isOwner });
  return {
    accounts: {
      main: data.main ? toView(data.main, "main") : null,
      active: data.active.map((a) => toView(a, "active")),
      flagged: data.flagged.map((a) => toView(a, "flagged")),
      private: data.privateAccounts.map((a) => toView(a, "private")),
    },
    count: data.count,
  };
}
