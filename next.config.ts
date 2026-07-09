import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    // Stray C:\Users\aaron\package-lock.json makes Turbopack infer the wrong root,
    // which breaks every route except / (404 on /app, /login, etc.).
    root: projectRoot,
  },
  experimental: {
    serverActions: {
      // Bulk CSV imports post the whole file as text (default limit is 1 MB)
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
