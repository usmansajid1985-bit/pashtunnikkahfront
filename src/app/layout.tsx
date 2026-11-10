import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Poppins } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/notifications/service-worker-registrar";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { LiveUpdates } from "@/components/notifications/live-updates";
import { GoldUpsellHost } from "@/components/billing/gold-upsell";
import { MemberWarningGate } from "@/components/notifications/member-warning-gate";
import { TribeConfirmGate } from "@/components/tribe/tribe-confirm-gate";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

// Poppins is the app-wide UI font (T3): Regular 400 body, Medium 500 pills/labels,
// SemiBold 600 section headings/buttons, Bold 700 main headings.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Pashtun Nikah — Find your Nikah, the right way",
    template: "%s | Pashtun Nikah",
  },
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
  themeColor: "#ffffff",
  viewportFit: "cover",
  // K09: Android Chrome shrinks the layout when the keyboard opens, so the chat header stays put.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${fraunces.variable} ${poppins.variable} antialiased`}>
        <ServiceWorkerRegistrar />
        <PresenceHeartbeat />
        <LiveUpdates />
        <GoldUpsellHost />
        <MemberWarningGate />
        <TribeConfirmGate />
        {children}
      </body>
    </html>
  );
}
