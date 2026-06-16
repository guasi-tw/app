import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a native (libvips) module. Keep it external so Next bundles it
  // from node_modules and traces its native .so files (libvips-cpp) into the
  // serverless function — otherwise avatar processing crashes at runtime with
  // ERR_DLOPEN_FAILED on the linux-x64 Vercel runtime.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
