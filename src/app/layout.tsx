import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Suspense } from "react";

import { AppShell } from "@/components/app-shell";

import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Metro Trailer",
    template: "%s | Metro Trailer",
  },
  description:
    "Operational backbone for trailer rental, dispatch, invoicing, inspections, maintenance, payments, and integrations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body className="min-h-screen">
        <Suspense
          fallback={
            <div className="min-h-screen bg-[var(--background)] p-3">
              <div className="workspace-skeleton h-14 w-full" />
              <div className="mt-3 grid gap-2 lg:grid-cols-[108px_1fr]">
                <div className="workspace-skeleton hidden h-[calc(100vh-88px)] lg:block" />
                <div className="grid gap-2">
                  <div className="workspace-skeleton h-24 w-full" />
                  <div className="workspace-skeleton h-80 w-full" />
                </div>
              </div>
            </div>
          }
        >
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
