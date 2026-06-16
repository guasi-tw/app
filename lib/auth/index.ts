import NextAuth from "next-auth";
import { prisma } from "@/lib/db/client";
import { createAuthAdapter } from "./adapter";
import { providers } from "./providers";
import { signInCallback } from "./callbacks";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: createAuthAdapter(prisma),
  session: { strategy: "database" }, // server-side revocation for §6.8 hacked-account flows
  providers,
  trustHost: true, // Vercel / proxied hosts
  callbacks: { signIn: signInCallback },
  pages: { signIn: "/login" },
});
