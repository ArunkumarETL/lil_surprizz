import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "LILSURPRIZ | Little gifts, big surprises", template: "%s | LILSURPRIZ" },
  description: "Thoughtfully curated gift hampers and personalised surprises for every occasion, delivered across India.",
  openGraph: { title: "LILSURPRIZ", description: "Little gifts, big surprises.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body><Providers><SiteHeader />{children}<SiteFooter /></Providers></body></html>;
}
