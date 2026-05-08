import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    instantNavigationDevToolsToggle: true,
    prerenderEarlyExit: false,
    serverMinification: false,
  },
};

export default nextConfig;
