import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { NativeUpdatePrompt } from "@/components/native-update-prompt";
import { WhiteScreenRecovery } from "@/components/WhiteScreenRecovery";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RememberOne",
  description:
    "Log the people you meet, let AI extract their details, and get reminders before your next meeting.",
  // PWA / mobile app meta
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RememberOne",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // fills the notch area on iPhone
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Fonts via <link> (discovered during initial HTML parse) + preconnect,
            instead of a render-blocking CSS @import that was fetched late.
            display=swap avoids a blank-text flash. Literal family names are kept
            so existing inline `fontFamily` styles are unchanged. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Hammersmith+One&family=Instrument+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body className={inter.className}>
        {children}
        <WhiteScreenRecovery />
        <NativeUpdatePrompt />
        <Toaster />
      </body>
    </html>
  );
}
