import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    // Cache strategies
    runtimeCaching: [
      // Cache static assets (fonts, images, scripts, styles)
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /\.(png|jpg|jpeg|svg|gif|ico|webp)$/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "images",
          expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      // Cache Next.js static chunks
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: { maxEntries: 256, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
      // Cache app pages (network first, fall back to cache)
      {
        urlPattern: /^https:\/\/need-you\.xyz\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "pages",
          networkTimeoutSeconds: 10,
          expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  // Disable React Strict Mode — its effect double-invocation causes useModalHistory
  // cleanup to call history.back() immediately after opening, closing modals instantly.
  // This only happened in dev (browser); APK uses production build where effects run once.
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["firebase-admin"],
  devIndicators: {
    position: "bottom-left",
  },
  turbopack: {},
};

export default withPWA(nextConfig);
