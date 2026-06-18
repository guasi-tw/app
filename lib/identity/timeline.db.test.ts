import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { listTimelineEvents } from "./timeline";

const hasDb = !!process.env.DATABASE_URL;
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

type EventSeed = {
  eventType:
    | "bound" | "disclosed" | "set_main"
    | "reported_banned" | "reported_hacked" | "re_verified" | "unbound";
  accountId: string;
  createdAt: Date;
  proofPostUrl?: string; // creates a ProofRecord and links it
};

type AccountSeed = {
  accountId: string;
  handle: string;
  visibility?: "public" | "private";
};

// Seed a 正身 with linked accounts + binding events (+ optional proof records).
async function seedUser(
  shortRef: string,
  accounts: AccountSeed[],
  events: EventSeed[],
  onboardedAt?: Date,
) {
  const user = await prisma.user.create({
    data: {
      email: `${shortRef}@example.com`,
      shortRef,
      onboardedAt: onboardedAt ?? null,
      linkedAccounts: {
        create: accounts.map((a) => ({
          platform: "threads",
          accountId: a.accountId,
          handle: a.handle,
          status: "verified",
          visibility: a.visibility ?? "public",
        })),
      },
    },
  });
  createdUserIds.push(user.id);

  for (const e of events) {
    let proofRecordId: string | undefined;
    if (e.proofPostUrl) {
      const la = await prisma.linkedAccount.findFirst({
        where: { userId: user.id, accountId: e.accountId },
      });
      const proof = await prisma.proofRecord.create({
        data: {
          linkedAccountId: la!.id,
          proofPostUrl: e.proofPostUrl,
          authCode: "000000",
          authorHandle: e.accountId,
        },
      });
      proofRecordId = proof.id;
    }
    await prisma.bindingEvent.create({
      data: {
        userId: user.id,
        platform: "threads",
        accountId: e.accountId,
        eventType: e.eventType,
        proofRecordId: proofRecordId ?? null,
        createdAt: e.createdAt,
      },
    });
  }
  return user;
}

describe.skipIf(!hasDb)("listTimelineEvents (DB)", () => {
  it("non-owner: private-account events absent; genesis + public events only", async () => {
    const user = await seedUser(
      "TlVis01",
      [
        { accountId: "pub", handle: "pub", visibility: "public" },
        { accountId: "sec", handle: "sec", visibility: "private" },
      ],
      [
        { eventType: "bound", accountId: "pub", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/pub" },
        { eventType: "bound", accountId: "sec", createdAt: new Date("2026-02-02"), proofPostUrl: "https://t/sec" },
      ],
      new Date("2026-01-01"),
    );

    const res = await listTimelineEvents(user.id, { includePrivate: false });

    expect(res.map((e) => e.kind)).toEqual(["genesis", "bound"]);
    expect(res.find((e) => e.handle === "sec")).toBeUndefined();
    expect(res[0].kind).toBe("genesis");
    expect(res[1].handle).toBe("pub");
  });

  it("owner (includePrivate): private events present and flagged isPrivate", async () => {
    const user = await seedUser(
      "TlOwn01",
      [
        { accountId: "pub", handle: "pub", visibility: "public" },
        { accountId: "sec", handle: "sec", visibility: "private" },
      ],
      [
        { eventType: "bound", accountId: "pub", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/pub" },
        { eventType: "bound", accountId: "sec", createdAt: new Date("2026-02-02"), proofPostUrl: "https://t/sec" },
      ],
    );

    const res = await listTimelineEvents(user.id, { includePrivate: true });

    const sec = res.find((e) => e.handle === "sec");
    expect(sec?.isPrivate).toBe(true);
    const pub = res.find((e) => e.handle === "pub");
    expect(pub?.isPrivate).toBe(false);
  });

  it("disclosure history: a bound-private-then-disclosed account shows its bound event once public", async () => {
    const user = await seedUser(
      "TlDisc01",
      [{ accountId: "later", handle: "later", visibility: "public" }], // currently public
      [
        { eventType: "bound", accountId: "later", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/l" },
        { eventType: "disclosed", accountId: "later", createdAt: new Date("2026-03-01") },
      ],
    );

    const res = await listTimelineEvents(user.id, { includePrivate: false });

    // The whole history surfaces because the account is public NOW.
    expect(res.map((e) => e.kind)).toEqual(["genesis", "bound", "disclosed"]);
  });

  it("proofPostUrl attached on bound/re_verified only; null elsewhere", async () => {
    const user = await seedUser(
      "TlProof01",
      [{ accountId: "a", handle: "a", visibility: "public" }],
      [
        { eventType: "bound", accountId: "a", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/b" },
        { eventType: "set_main", accountId: "a", createdAt: new Date("2026-02-02") },
        { eventType: "re_verified", accountId: "a", createdAt: new Date("2026-02-03"), proofPostUrl: "https://t/r" },
      ],
    );

    const res = await listTimelineEvents(user.id, { includePrivate: false });
    const byKind = Object.fromEntries(res.map((e) => [e.kind, e]));
    expect(byKind.bound.proofPostUrl).toBe("https://t/b");
    expect(byKind.re_verified.proofPostUrl).toBe("https://t/r");
    expect(byKind.set_main.proofPostUrl).toBeNull();
  });

  it("order createdAt asc, genesis first; genesis date = onboardedAt ?? createdAt", async () => {
    const onboarded = new Date("2026-01-15T00:00:00.000Z");
    const user = await seedUser(
      "TlOrder01",
      [{ accountId: "a", handle: "a", visibility: "public" }],
      [
        { eventType: "bound", accountId: "a", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/b" },
        { eventType: "set_main", accountId: "a", createdAt: new Date("2026-03-01") },
      ],
      onboarded,
    );

    const res = await listTimelineEvents(user.id, { includePrivate: false });
    expect(res[0].kind).toBe("genesis");
    expect(res[0].createdAt.getTime()).toBe(onboarded.getTime());
    expect(res.slice(1).map((e) => e.kind)).toEqual(["bound", "set_main"]);
  });

  it("defensive: an event whose account is missing is skipped", async () => {
    const user = await seedUser(
      "TlMiss01",
      [{ accountId: "a", handle: "a", visibility: "public" }],
      [
        { eventType: "bound", accountId: "a", createdAt: new Date("2026-02-01"), proofPostUrl: "https://t/b" },
        { eventType: "set_main", accountId: "ghost", createdAt: new Date("2026-02-02") }, // no such account
      ],
    );

    const res = await listTimelineEvents(user.id, { includePrivate: false });
    expect(res.map((e) => e.kind)).toEqual(["genesis", "bound"]);
  });
});
