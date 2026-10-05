import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ships a platform-specific native binary — bundling it (the Turbopack/webpack default)
  // instead of leaving it as a plain external require can break the binary lookup at runtime on
  // Vercel. Same reason nodemailer is listed here.
  serverExternalPackages: ["nodemailer", "sharp"],
  // …and the binary itself lives in the optional @img/* packages, which the build's file tracing
  // doesn't follow from a lazy import("sharp") — without this, sharp fails to load on Vercel
  // ("Could not load the sharp module using the linux-x64 runtime").
  outputFileTracingIncludes: {
    "/*": ["./node_modules/sharp/**/*", "./node_modules/@img/**/*"],
  },
  async headers() {
    return [
      {
        source: "/uploads/hero/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/firebase-messaging-sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
