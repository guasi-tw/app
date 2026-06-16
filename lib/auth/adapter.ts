import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import type { Adapter, AdapterUser } from "next-auth/adapters";

/** Canonicalize an email so the stored User.email is the stable join key (spec §4). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Fold normalization + one-time profile seeding into the single User insert.
 * `displayName`/`avatarUrl` are seeded from the Google profile as EDITABLE defaults
 * and only ever written here (createUser fires once), so later edits aren't clobbered.
 */
export function buildCreateUserInput<T extends { email?: string | null; name?: string | null; image?: string | null }>(
  data: T,
): T & { email: string | null; displayName: string | null; avatarUrl: string | null } {
  return {
    ...data,
    email: data.email ? normalizeEmail(data.email) : (data.email ?? null),
    displayName: data.name ?? null,
    avatarUrl: data.image ?? null,
  };
}

/** PrismaAdapter with a createUser wrapper (normalize email + seed profile). */
export function createAuthAdapter(prisma: PrismaClient): Adapter {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    createUser: (data) => base.createUser!(buildCreateUserInput(data) as AdapterUser),
  };
}
