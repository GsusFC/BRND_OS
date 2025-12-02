import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";
import FarcasterProvider from "@/context/FarcasterProvider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

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
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${drukWide.variable} antialiased bg-background text-foreground`}
      >
        <NextIntlClientProvider messages={messages}>
          <FarcasterProvider>
            {children}
          </FarcasterProvider>
        </NextIntlClientProvider>
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
