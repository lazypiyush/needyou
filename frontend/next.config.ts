import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',           // Static export for Firebase
  images: {
    unoptimized: true         // Required for static export
  },
  trailingSlash: true,        // Firebase routing
  assetPrefix: './',          // Static assets
};

export default nextConfig;
