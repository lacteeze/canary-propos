import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Bulk CSV imports post the whole file as text (default limit is 1 MB)
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
