import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import {
  findUserByShortRef,
  findUserBySlug,
  updateUserProfile,
} from "./repo";

const hasDb = !!process.env.DATABASE_URL;
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  }
  await prisma.$disconnect();
});

describe.skipIf(!hasDb)("identity repo (DB)", () => {
  it("finds by shortRef and looks up slug case-insensitively", async () => {
    const u = await prisma.user.create({
      data: { email: "repo-test@example.com", shortRef: "RepoTest01", slug: "AliceCase" },
    });
    createdIds.push(u.id);

    expect((await findUserByShortRef("RepoTest01"))?.id).toBe(u.id);
    expect((await findUserBySlug("alicecase"))?.id).toBe(u.id); // citext → CI match
    expect(await findUserBySlug("nope-not-here")).toBeNull();
  });

  it("updateUserProfile writes fields and bumps updatedAt", async () => {
    const u = await prisma.user.create({
      data: { email: "repo-update@example.com", shortRef: "RepoUpd001" },
    });
    createdIds.push(u.id);
    const before = u.updatedAt;

    await new Promise((r) => setTimeout(r, 5));
    const updated = await updateUserProfile(u.id, {
      displayName: "Bob",
      bio: "hi",
      avatarUrl: "https://blob/x.webp",
    });
    expect(updated.displayName).toBe("Bob");
    expect(updated.bio).toBe("hi");
    expect(updated.avatarUrl).toBe("https://blob/x.webp");
    expect(updated.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });
});
