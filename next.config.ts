import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    prerenderEarlyExit: false,
    serverMinification: false,
  },
};

export default nextConfig;
