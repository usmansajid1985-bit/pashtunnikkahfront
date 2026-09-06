import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/notifications/service-worker-registrar";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pashtun Nikah — Find your Nikah, the right way",
  description:
    "The first dedicated Pashtun matrimony platform — connecting families with trust, tradition, and transparency.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pashtun Nikah",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/images/fav.png", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/icons/pn-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#aa1945",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
        <ServiceWorkerRegistrar />
        <PresenceHeartbeat />
        {children}
      </body>
    </html>
  );
}
