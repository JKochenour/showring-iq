import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Space_Grotesk } from "next/font/google";
import { ConfirmDialogProvider } from "@/components/confirm-dialog";
import { PwaSetup } from "@/components/pwa";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

// Marketing display face (the app keeps Fraunces via .font-display).
const spaceGrotesk = Space_Grotesk({
  variable: "--font-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShowRing IQ",
  description:
    "The modern horse show operating system for entries, scoring, eligibility, results, and association-ready reporting.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-stone-900">
        <PwaSetup />
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
      </body>
    </html>
  );
}
