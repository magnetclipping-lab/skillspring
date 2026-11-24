import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/bricolage-grotesque/standard.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: "Proofwork — Build Skills That Move You Forward", template: "%s · Proofwork" },
  description: "Practical courses in AI, digital marketing, Excel and business analysis, with real assignments evaluated against clear rubrics. ₹7,500 per course.",
  applicationName: "Proofwork",
  openGraph: {
    type: "website",
    siteName: "Proofwork",
    locale: "en_IN",
    title: "Proofwork — Build Skills That Move You Forward",
    description: "Practical courses in AI, digital marketing, professional tools and business, with real assignments and rubric-based feedback.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#080b12", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className="h-full bg-canvas">
      <body className="flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lift">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
