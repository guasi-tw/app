import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { listIdentityAccounts } from "./repo";

const hasDb = !!process.env.DATABASE_URL;
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

// Helper: create a 正身 with a set of linked accounts.
async function seedUser(
  shortRef: string,
  accounts: Array<{
    handle: string;
    accountId: string;
    visibility?: "public" | "private";
    condition?: "active" | "banned" | "hacked";
    isMain?: boolean;
    verifiedAt?: Date;
  }>,
) {
  const user = await prisma.user.create({
    data: {
      email: `${shortRef}@example.com`,
      shortRef,
      linkedAccounts: {
        create: accounts.map((a) => ({
          platform: "threads",
          accountId: a.accountId,
          handle: a.handle,
          status: "verified",
          visibility: a.visibility ?? "public",
          condition: a.condition ?? "active",
          isMain: a.isMain ?? false,
          verifiedAt: a.verifiedAt ?? new Date(),
        })),
      },
    },
  });
  createdUserIds.push(user.id);
  return user;
}

describe.skipIf(!hasDb)("listIdentityAccounts (DB)", () => {
  it("anonymous visitor sees only public+verified; private hidden; flagged last; oldest-first", async () => {
    const user = await seedUser("IdAcctVis01", [
      { handle: "secret", accountId: "secret", visibility: "private" },
      { handle: "newer", accountId: "newer", verifiedAt: new Date("2026-02-01") },
      { handle: "older", accountId: "older", verifiedAt: new Date("2026-01-01") },
      { handle: "main1", accountId: "main1", isMain: true },
      { handle: "hijacked", accountId: "hijacked", condition: "hacked" },
    ]);

    const res = await listIdentityAccounts(user.id, { includePrivate: false });

    expect(res.main?.handle).toBe("main1");
    expect(res.active.map((a) => a.handle)).toEqual(["older", "newer"]); // oldest-first
    expect(res.flagged.map((a) => a.handle)).toEqual(["hijacked"]);
    expect(res.privateAccounts).toEqual([]); // private hidden for visitor
    expect(res.count).toBe(3); // main + 2 active; excludes private + flagged
  });

  it("owner also gets private rows (still excluded from count)", async () => {
    const user = await seedUser("IdAcctOwn01", [
      { handle: "pub", accountId: "pub" },
      { handle: "hidden", accountId: "hidden", visibility: "private" },
    ]);

    const res = await listIdentityAccounts(user.id, { includePrivate: true });

    expect(res.active.map((a) => a.handle)).toEqual(["pub"]);
    expect(res.privateAccounts.map((a) => a.handle)).toEqual(["hidden"]);
    expect(res.count).toBe(1); // private never counts
  });

  it("a flagged main is demoted to flagged, not featured, and not counted", async () => {
    const user = await seedUser("IdAcctFlag1", [
      { handle: "bannedmain", accountId: "bannedmain", isMain: true, condition: "banned" },
      { handle: "good", accountId: "good" },
    ]);

    const res = await listIdentityAccounts(user.id, { includePrivate: false });

    expect(res.main).toBeNull();
    expect(res.flagged.map((a) => a.handle)).toEqual(["bannedmain"]);
    // The ex-main keeps its latent isMain flag — this is what `buildAccountGroups.mainFlagged`
    // keys off to nudge the owner (recovery silently restores it as main; §C.2/§C.4).
    expect(res.flagged[0].isMain).toBe(true);
    expect(res.active.map((a) => a.handle)).toEqual(["good"]);
    expect(res.count).toBe(1); // only "good"
  });
});
