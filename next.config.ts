import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp ships a platform-specific native binary — bundling it (the Turbopack/webpack default)
  // instead of leaving it as a plain external require can break the binary lookup at runtime on
  // Vercel. Same reason nodemailer is listed here.
  serverExternalPackages: ["nodemailer", "sharp"],
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
