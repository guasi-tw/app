import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { createAuthAdapter } from "./adapter";

const hasDb = !!process.env.DATABASE_URL;
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  }
  await prisma.$disconnect();
});

describe.skipIf(!hasDb)("createAuthAdapter.createUser (DB)", () => {
  it("creates a 正身 with a normalized email and seeded profile", async () => {
    const adapter = createAuthAdapter(prisma);
    const user = await adapter.createUser!({
      id: "ignored-by-prisma",
      email: " New.User@Example.COM ",
      emailVerified: null,
      name: "New User",
      image: "https://example.com/avatar.png",
    });
    createdIds.push(user.id);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.email).toBe("new.user@example.com");
    expect(row.displayName).toBe("New User");
    expect(row.avatarUrl).toBe("https://example.com/avatar.png");
    expect(row.bio).toBeNull(); // not seeded — user fills this in later
    expect(row.shortRef).toHaveLength(10); // base62 token minted at creation
    expect(row.slug).toBeNull(); // not minted until main-account designation (Slice 2)
    expect(row.updatedAt).toBeInstanceOf(Date);
  });
});
