import { prisma } from "@/lib/db/client";

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export function findUserByShortRef(shortRef: string) {
  return prisma.user.findUnique({ where: { shortRef } });
}

/** Case-insensitive by virtue of the `slug` citext column (§H.2). */
export function findUserBySlug(slug: string) {
  return prisma.user.findUnique({ where: { slug } });
}

export function updateUserProfile(
  id: string,
  data: { displayName: string; bio: string | null; avatarUrl?: string },
) {
  return prisma.user.update({ where: { id }, data });
}
