import { auth } from "@/lib/auth";
import { findUserById } from "./repo";

/** The full 正身 row for the logged-in viewer, or null if not signed in. */
export async function getCurrentUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return findUserById(id);
}
