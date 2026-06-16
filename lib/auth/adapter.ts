import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { generateShortRef } from "@/lib/identity/short-ref";

/** Canonicalize an email so the stored User.email is the stable join key (spec §4). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Fold normalization + one-time profile seeding + the shortRef into the User insert.
 * `displayName`/`avatarUrl` seed from Google as EDITABLE defaults (createUser fires once).
 * `shortRef` is the /r/{shortRef} token — every 正身 gets one at creation (§H.2).
 */
export function buildCreateUserInput<
  T extends { email?: string | null; name?: string | null; image?: string | null },
>(
  data: T,
  shortRef: string,
): T & { email: string | null; displayName: string | null; avatarUrl: string | null; shortRef: string } {
  return {
    ...data,
    email: data.email ? normalizeEmail(data.email) : (data.email ?? null),
    displayName: data.name ?? null,
    avatarUrl: data.image ?? null,
    shortRef,
  };
}

/** True only for a Prisma unique-violation (P2002) on the shortRef index. */
export function isShortRefCollision(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err.code !== "P2002") return false;
  const target = err.meta?.target;
  const s = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return s.toLowerCase().includes("shortref");
}

/**
 * Insert a user, regenerating the shortRef and retrying ONLY on a shortRef
 * collision (any other unique violation — e.g. email — rethrows immediately).
 */
export async function createUserWithRetry(
  // `insert` is the adapter's createUser: param is the built input (always carries
  // a shortRef), return is Awaitable (the PrismaAdapter signature), not a bare Promise.
  insert: (input: AdapterUser & { shortRef: string }) => AdapterUser | PromiseLike<AdapterUser>,
  data: AdapterUser,
  genRef: () => string,
  maxAttempts = 5,
): Promise<AdapterUser> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await insert(buildCreateUserInput(data, genRef()));
    } catch (e) {
      if (isShortRefCollision(e) && attempt < maxAttempts) continue;
      throw e;
    }
  }
  throw new Error("createUser: exhausted shortRef attempts");
}

/** PrismaAdapter with a createUser wrapper (normalize email + seed profile + shortRef). */
export function createAuthAdapter(prisma: PrismaClient): Adapter {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    createUser: (data) => createUserWithRetry(base.createUser!, data, generateShortRef),
  };
}
