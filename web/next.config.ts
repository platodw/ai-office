import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000", "localhost:7850"] },
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
