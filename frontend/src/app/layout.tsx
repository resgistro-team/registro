import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { Suspense } from "react";
import { AskRegistro } from "@/components/assistant/AskRegistro";
import { PageTransition } from "@/components/PageTransition";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const body = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Registro",
  description: "Everything happening. Find an event, register, and show up.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <PageTransition />
        {children}
        {/* It reads the URL, which only exists at request time. */}
        <Suspense fallback={null}>
          <AskRegistro />
        </Suspense>
      </body>
    </html>
  );
}
