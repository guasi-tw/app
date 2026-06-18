// lib/binding/slug.db.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { isSlugAvailable } from "./slug";

const hasDb = !!process.env.DATABASE_URL;
const createdIds: string[] = [];

// This fixture uses FIXED unique values (email/slug/shortRef). If a prior run is interrupted
// before `afterAll` cleans up, the leaked row wedges every later run on the `email` unique
// constraint. Match it on all three unique keys so cleanup is robust regardless of which one a
// stale row collides on.
const FIXTURE_WHERE = {
  OR: [
    { email: "slug-avail@example.com" },
    { slug: "TakenName" },
    { shortRef: "SlugAvail1" },
  ],
};

// Clear any leaked fixture from an interrupted prior run so create() never hits a stale unique row.
beforeAll(async () => {
  if (hasDb) await prisma.user.deleteMany({ where: FIXTURE_WHERE });
});

afterAll(async () => {
  if (createdIds.length) await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
});

describe.skipIf(!hasDb)("isSlugAvailable (DB)", () => {
  it("is false when a slug is taken (case-insensitive) and true otherwise", async () => {
    const u = await prisma.user.create({
      data: { email: "slug-avail@example.com", shortRef: "SlugAvail1", slug: "TakenName" },
    });
    createdIds.push(u.id);
    expect(await isSlugAvailable("takenname")).toBe(false); // citext CI match
    expect(await isSlugAvailable("a-free-name-xyz")).toBe(true);
  });
});
