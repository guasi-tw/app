// lib/binding/slug.db.test.ts
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { isSlugAvailable } from "./slug";

const hasDb = !!process.env.DATABASE_URL;
const createdIds: string[] = [];

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
