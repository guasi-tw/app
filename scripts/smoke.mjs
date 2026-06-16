#!/usr/bin/env node
// Zero-dependency post-deploy smoke test (§3.8).
// Asserts a list of (url, expected-status) checks against a freshly-deployed URL;
// exits non-zero on any mismatch. Runnable by hand and from CI (.github/workflows/smoke.yml).
//
// Inputs (env, with argv fallback for local runs):
//   TARGET_URL          the deployed URL (deployment_status.target_url) — or argv[2]
//   ENVIRONMENT         "Production" | "Preview" (deployment_status.environment)
//   HEALTH_CHECK_SECRET shared secret for the x-health-token header (§3.7)
//   VERCEL_AUTOMATION_BYPASS_SECRET  bypasses Vercel preview Deployment Protection (§3.9)
//
// On Production it exercises the canonical public surface (guasi.tw + www); on Preview it
// only hits the deploy's own /api/health (apex/www are production-only). Preview *.vercel.app
// URLs sit behind Vercel Authentication, so we send the protection-bypass header on every
// request (harmless on the public production domain).

const token = process.env.HEALTH_CHECK_SECRET ?? "";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
const environment = (process.env.ENVIRONMENT ?? "preview").toLowerCase();
const targetUrl = (process.env.TARGET_URL ?? process.argv[2] ?? "").replace(/\/+$/, "");

// Sent on every request; only matters for protected preview deployments (§3.9).
const bypassHeaders = bypass ? { "x-vercel-protection-bypass": bypass } : {};

if (!targetUrl) {
  console.error("smoke: no TARGET_URL (set env TARGET_URL or pass as argv[1])");
  process.exit(2);
}
if (!token) {
  console.error("smoke: no HEALTH_CHECK_SECRET");
  process.exit(2);
}

const isProd = environment === "production";
// Production: test the real domain. Preview: the deployment URL.
const healthBase = isProd ? "https://guasi.tw" : targetUrl;

const checks = [
  { name: "health (with token → 200)", url: `${healthBase}/api/health`, headers: { "x-health-token": token }, expect: 200 },
  { name: "health (no token → 401)", url: `${healthBase}/api/health`, expect: 401 },
  // Runs the real avatar pipeline → proves sharp's native libvips loads on this
  // runtime. Gates the ERR_DLOPEN_FAILED class of failure before it reaches prod.
  { name: "imaging (sharp pipeline → 200)", url: `${healthBase}/api/health/imaging`, headers: { "x-health-token": token }, expect: 200 },
];

if (isProd) {
  checks.push(
    { name: "apex (→ 200)", url: "https://guasi.tw", expect: 200 },
    // www 308-redirects to the apex — follow it and assert the final 200 (§3.8 note).
    { name: "www (308→apex, → 200)", url: "https://www.guasi.tw", expect: 200 },
  );
}

let failed = 0;
for (const check of checks) {
  try {
    const res = await fetch(check.url, {
      method: "GET",
      headers: { ...bypassHeaders, ...(check.headers ?? {}) },
      redirect: "follow",
    });
    const ok = res.status === check.expect;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${check.name}  [got ${res.status}, want ${check.expect}]  ${check.url}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${check.name}  [fetch error: ${err.message}]  ${check.url}`);
  }
}

console.log(`\nsmoke: ${checks.length - failed}/${checks.length} passed (${environment})`);
process.exit(failed ? 1 : 0);
