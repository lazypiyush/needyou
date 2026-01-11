import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 🔥 REMOVED: output: 'export' - Vercel SSR ke liye
  images: {
    unoptimized: true
  },
  // Vercel server components support
  serverExternalPackages: ['firebase-admin'],
  // Move Next.js development indicator to bottom-right
  devIndicators: {
    position: 'bottom-right'
  }
};

export default nextConfig;
