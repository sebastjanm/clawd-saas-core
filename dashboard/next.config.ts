import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standard mode (not standalone) - see lessons-learned
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
