import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";
import FarcasterProvider from "@/context/FarcasterProvider";
import Web3Provider from "@/context/Web3Provider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { headers } from "next/headers";
import { ClipboardPolyfill } from "@/components/ClipboardPolyfill";
import { defaultLocale } from "@/i18n/config";
import defaultMessages from "../../messages/en.json";

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
  let locale = defaultLocale;
  let messages: Record<string, string> = defaultMessages as Record<string, string>;
  let cookies: string | null = null;

  try {
    locale = await getLocale();
    messages = await getMessages();
  } catch (error) {
    console.error("layout intl error:", error);
  }

  try {
    const headersList = await headers();
    cookies = headersList.get("cookie");
  } catch (error) {
    console.error("layout headers error:", error);
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${drukWide.variable} antialiased bg-background text-foreground`}
      >
        <NextIntlClientProvider messages={messages}>
          <Web3Provider cookies={cookies}>
            <FarcasterProvider>
              <ClipboardPolyfill />
              {children}
            </FarcasterProvider>
          </Web3Provider>
        </NextIntlClientProvider>
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
