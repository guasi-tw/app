import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// Prisma needs the Node.js runtime (it can't run on Edge) — §4.
export const runtime = "nodejs";
// Never cache a liveness probe.
export const dynamic = "force-dynamic";

// Token-gated DB health check (§3.7). The token is checked BEFORE any DB work, so an
// anonymous flood costs ~nothing (no Prisma call, no warm Neon compute). Fail closed:
// if the secret is unset, every request is unauthorized.
export async function GET(request: Request) {
  const expected = process.env.HEALTH_CHECK_SECRET;
  const provided = request.headers.get("x-health-token");

  if (!expected || provided !== expected) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  try {
    // A real read against the migrated table — green proves the migration ran,
    // not just that a connection opened (§5).
    await prisma.healthCheck.count();
    return NextResponse.json({
      status: "ok",
      db: "up",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ status: "error", db: "down" }, { status: 500 });
  }
}
