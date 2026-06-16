import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a native (libvips) module — keep it external so it's loaded from
  // node_modules at runtime rather than bundled.
  serverExternalPackages: ["sharp"],
  // The libvips native lib lives in a SEPARATE package (@img/sharp-libvips-
  // linux-x64) that file-tracing doesn't follow from sharp, so it's missing
  // from the serverless function bundle → ERR_DLOPEN_FAILED at runtime even
  // though it's installed at build time. Force-include the platform binaries
  // into every server trace. ("**" matches all route paths; values are globs
  // from the project root.)
  outputFileTracingIncludes: {
    "**": ["node_modules/@img/**/*", "node_modules/sharp/**/*"],
  },
};

export default nextConfig;
