import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for the hero headline and big numbers only; all UI
// text stays in Geist.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Inter is the fallback sans if Geist fails to load.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Absolute base for social-share URLs: the deployed site URL when
  // configured, Vercel's per-deployment URL otherwise.
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : process.env.VERCEL_URL
      ? new URL(`https://${process.env.VERCEL_URL}`)
      : undefined,
  title: {
    default: "LinkLens — Secure Phishing Website Detection",
    template: "%s | LinkLens",
  },
  description:
    "Scan any URL with machine learning and URL analysis to detect phishing websites before you click.",
  openGraph: {
    type: "website",
    siteName: "LinkLens",
    title: "LinkLens — Secure Phishing Website Detection",
    description:
      "Check any link for phishing before you click — verdict, confidence, and the signals behind it.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LinkLens — Secure Phishing Website Detection",
    description:
      "Check any link for phishing before you click — verdict, confidence, and the signals behind it.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${spaceGrotesk.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          <QueryProvider>
            <ToastProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
            >
              Skip to main content
            </a>
            <Navbar />
            <main
              id="main-content"
              className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6"
            >
              {children}
            </main>
            <Footer />
            </ToastProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
