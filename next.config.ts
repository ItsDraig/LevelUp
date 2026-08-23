import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to serve dev-only assets to phones/tablets on the LAN.
  // Without this, Next blocks cross-origin dev requests and the page loads broken.
  allowedDevOrigins: ["10.0.0.100"],

  turbopack: {
    // Pin the workspace root to this project.
    //
    // Turbopack infers the root by walking up looking for a lockfile, and finds
    // a stray C:\Users\Oliver\package-lock.json (85 bytes, no package.json
    // beside it) -- so it was treating the whole user profile as the workspace
    // root on every build, widening module resolution and filesystem watching
    // far beyond this project.
    //
    // Pinning it here rather than deleting that file keeps the fix in the repo,
    // so it holds on CI and on any other machine with similar leftovers.
    root: __dirname,
  },
};

export default nextConfig;
