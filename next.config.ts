import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to serve dev-only assets to phones/tablets on the LAN.
  // Without this, Next blocks cross-origin dev requests and the page loads broken.
  allowedDevOrigins: ["10.0.0.100"],
};

export default nextConfig;
