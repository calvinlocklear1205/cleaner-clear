import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter, Kaushan_Script } from "next/font/google";
import { event } from "@/config/event";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const bebas = Bebas_Neue({ variable: "--font-bebas", weight: "400", subsets: ["latin"] });
const kaushan = Kaushan_Script({ variable: "--font-kaushan", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: `${event.name} ${event.tagline} ${event.year}`,
  description: "Snap what you pull out of the river and enter the contest.",
  appleWebApp: { capable: true, title: event.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e6b47",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${bebas.variable} ${kaushan.variable} antialiased`}>
      <body className="flex flex-col">{children}</body>
    </html>
  );
}
