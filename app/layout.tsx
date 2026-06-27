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
        {/* TEMPORARY iOS diagnostic (remove after debugging): runs before the app
            bundle and only on iOS. Captures JS errors and adds a red "dbg" badge
            that, when tapped, shows the user-agent, whether Capacitor is native,
            document.readyState, and any captured errors — so we can diagnose the
            iOS WKWebView without a console/device. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(!/iPhone|iPad|iPod/i.test(navigator.userAgent))return;var errs=[];function panel(){var el=document.getElementById('__roDbgPanel');if(el){el.remove();return;}el=document.createElement('div');el.id='__roDbgPanel';el.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#101010;color:#0f0;font:11px/1.45 monospace;padding:14px;overflow:auto;white-space:pre-wrap;word-break:break-word';var b=document.createElement('button');b.textContent='CLOSE';b.style.cssText='float:right;background:#0f0;color:#101010;border:0;padding:6px 12px;font:12px sans-serif;font-weight:700';b.onclick=function(){el.remove();};el.appendChild(b);var cap=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());var info='=== RememberOne iOS debug ===\\n\\nUA: '+navigator.userAgent+'\\n\\nCapacitor native: '+cap+'\\nreadyState: '+document.readyState+'\\nhref: '+location.href+'\\n\\nJS ERRORS ('+errs.length+'):\\n'+(errs.join('\\n\\n----\\n\\n')||'(none captured)');var p=document.createElement('div');p.textContent=info;el.appendChild(p);(document.body||document.documentElement).appendChild(el);}function badge(){if(document.getElementById('__roDbgBadge'))return;var bd=document.createElement('div');bd.id='__roDbgBadge';bd.textContent='dbg';bd.style.cssText='position:fixed;right:10px;bottom:10px;z-index:2147483646;background:#b00020;color:#fff;font:12px sans-serif;font-weight:700;padding:8px 12px;border-radius:18px;box-shadow:0 2px 6px rgba(0,0,0,.4)';bd.onclick=panel;(document.body||document.documentElement).appendChild(bd);}window.addEventListener('error',function(e){errs.push('[error] '+(e.message||(e.error&&e.error.message)||'?')+' @ '+(e.filename||'?')+':'+(e.lineno||'?')+((e.error&&e.error.stack)?'\\n'+e.error.stack:''));});window.addEventListener('unhandledrejection',function(e){var r=e.reason;errs.push('[promise] '+((r&&r.message)||r||'?')+((r&&r.stack)?'\\n'+r.stack:''));});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',badge);else badge();})();`,
          }}
        />
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
