import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree, Caveat } from "next/font/google";
import { SoundProvider } from "@/components/sound-provider";
import "./globals.css";

const figtree = Figtree({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-handwriting",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Cloaked - Protect Your Photos from AI",
  description: "Add invisible protection to your photos to prevent AI manipulation and deepfake generation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${figtree.variable} ${caveat.variable}`}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased film-grain`}
      >
        <SoundProvider>
          {children}
        </SoundProvider>
      </body>
    </html>
  );
}
