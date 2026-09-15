import type { Metadata } from "next";
import { GoogleAnalytics } from '@next/third-parties/google';
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/react"
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/seo"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "OpenAPI validator",
    "Agent-Ready Score",
    "AI agent API",
    "OpenAPI 3",
    "operationId",
    "API documentation for AI agents",
    "Spectral",
    "OAS Zod Validator",
  ],
  authors: [
    { name: "Appear", url: "https://appear.sh" },
    { name: "ctxpipe", url: "https://www.ctxpipe.ai" },
  ],
  creator: "Appear",
  publisher: "Appear",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en-AU" suppressHydrationWarning={true}>
      <body className="antialiased bg-[#010101]">
        {/* Background gradient - fixed positioned behind all content */}
        <div 
          className="fixed inset-0 -z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, #0a0a12 0%, #010101 100%)',
          }}
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/background-svg.svg" 
            alt="" 
            style={{
              width: '100vw',
              height: 'auto',
              minHeight: '100vh',
              objectFit: 'cover',
              objectPosition: 'top center',
              transform: 'scale(1.1)',
              transformOrigin: 'top center',
            }}
          />
        </div>

        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
        >
            {children}
        </ThemeProvider>

        {/* Google Analytics */}
        {process.env.NODE_ENV === 'production' && gaMeasurementId && (
            <GoogleAnalytics gaId={gaMeasurementId} />
        )}
        <Analytics />
      </body>
    </html>
  );
}
