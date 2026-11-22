import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: "SkillSpring — Learn Skills. Build Experience. Shape Your Future.", template: "%s · SkillSpring" },
  description: "Affordable, practical and career-focused courses, projects and internship opportunities for students across India.",
  applicationName: "SkillSpring",
  openGraph: {
    type: "website",
    siteName: "SkillSpring",
    locale: "en_IN",
    title: "SkillSpring — Learn Skills. Build Experience. Shape Your Future.",
    description: "Affordable, practical and career-focused learning designed to prepare students for the real world.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#141a4d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className="h-full">
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
