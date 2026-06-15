import { PrismaClient } from "@prisma/client";

// Single Prisma client, cached on globalThis in dev so Next's hot-reload doesn't
// open a new connection pool on every reload (§3.6). First occupant of the `lib/*`
// modular-monolith seam (deployment.md §3); repositories arrive with feature work.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
