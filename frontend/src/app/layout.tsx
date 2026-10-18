import type { Metadata, Viewport } from "next";
import "./globals.css";
import AuthProvider from "../components/AuthProvider";
import { AuthSessionProvider } from "../context/AuthContext";
import { ConfirmProvider } from "../context/ConfirmContext";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://quello.dev"),
  title: "Quello - Your second brain, backed by sources",
  applicationName: "Quello",
  description: "Quello is your second brain for content creation. The unified workspace for modern creators.",
  openGraph: {
    siteName: "Quello",
    title: "Quello - Your second brain, backed by sources",
    description: "Quello is your second brain for content creation. The unified workspace for modern creators.",
    url: "https://quello.dev",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quello - Your second brain, backed by sources",
    description: "Quello is your second brain for content creation. The unified workspace for modern creators.",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Quello",
    url: "https://quello.dev",
    logo: "https://quello.dev/favicon.svg",
  };
  return (
    <html lang="en">
      <body className="min-h-dvh relative bg-base text-text-primary font-base antialiased">
        {/* Pre-hydration session mirror: legacy sessions (or any state the
            regular flow missed) get their `quello_token` edge cookie rebuilt
            from storage before first paint, so middleware gating on the very
            first internal navigation matches what lib/auth.ts keeps in sync
            afterwards. Max-age mirrors SESSION_COOKIE_MAX_AGE in lib/auth.ts. */}
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html:
              "try{(function(){var t=localStorage.getItem('notebooklm_token');if(t&&!('; '+document.cookie).includes('; quello_token=')){var s=window.location.protocol==='https:'?'; secure':'';document.cookie='quello_token='+encodeURIComponent(t)+'; path=/; max-age=604800; samesite=lax'+s;}})()}catch(e){}",
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <AuthProvider>
          <AuthSessionProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </AuthSessionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
