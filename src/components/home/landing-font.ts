import { Poppins } from "next/font/google";

// Headline face for the landing page only; the app itself stays on Inter.
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});
