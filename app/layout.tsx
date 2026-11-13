import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import AppChrome from "@/components/AppChrome";
import PhoneOnly from "@/components/PhoneOnly";
import { APP_DESCRIPTION, APP_NAME, SITE_URL } from "@/lib/config";
import { THEME_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: "UNIPORT Map",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [{ url: "/icons/og.png", width: 1200, height: 630, alt: APP_NAME }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Updated at runtime by lib/theme-store.ts when the theme changes.
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${geistSans.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="h-full">
        <div className="app-frame">
          {children}
          <AppChrome />
        </div>
        <PhoneOnly />
      </body>
    </html>
  );
}
