import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";
import { headers } from "next/headers";
import Web3Provider from "@/context/Web3Provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const drukWide = localFont({
  src: "./fonts/DrukWide-Medium.woff",
  variable: "--font-druk",
});

export const metadata = {
  title: "BRND Admin",
  description: "Administration panel for BRND",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie");

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${drukWide.variable} antialiased bg-background text-foreground`}
      >
        <Web3Provider cookies={cookies}>
          {children}
        </Web3Provider>
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
