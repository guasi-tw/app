import { NextResponse } from "next/server";
import { processAvatar } from "@/lib/identity/avatar";

// sharp needs the Node.js runtime (native libvips addon) — and force-dynamic so
// this never gets cached as a build-time result.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Smallest valid PNG (1×1). Fed through the REAL avatar pipeline so this probe
// exercises sharp's native libvips load on the deployed runtime — the exact
// failure mode that crashed avatar uploads on Vercel (ERR_DLOPEN_FAILED).
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

// Token-gated imaging health check. Reuses HEALTH_CHECK_SECRET (same gate as
// /api/health) and fails closed: if the secret is unset, every request is 401.
export async function GET(request: Request) {
  const expected = process.env.HEALTH_CHECK_SECRET;
  const provided = request.headers.get("x-health-token");

  if (!expected || provided !== expected) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  try {
    const { data, contentType } = await processAvatar(TINY_PNG, "image/png");
    return NextResponse.json({
      status: "ok",
      imaging: "up",
      contentType,
      bytes: data.byteLength,
      time: new Date().toISOString(),
    });
  } catch (e) {
    // Surface the real error in the (token-gated) body so a failing smoke test is
    // diagnosable straight from the response, not just a bare 500.
    console.error("[health/imaging] sharp pipeline failed", e);
    return NextResponse.json(
      {
        status: "error",
        imaging: "down",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
