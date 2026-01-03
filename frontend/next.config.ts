import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🔥 REMOVED: output: 'export' - Vercel SSR ke liye
  images: {
    unoptimized: true
  },
  // Vercel server components support
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin']
  }
};

export default nextConfig;
