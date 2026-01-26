import type { Metadata } from "next";
// Import the GoogleAnalytics component
import { GoogleAnalytics } from '@next/third-parties/google';
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/react"


export const metadata: Metadata = {
  title: "Agent-Ready Score | Is Your API Ready for AI Agents? | Appear",
  description: "Measure how ready your OpenAPI specification is for AI agent consumption. Get a comprehensive score across 6 dimensions: compliance, semantic richness, usability, discoverability, security, and error handling.",
  keywords: ["OpenAPI", "API validation", "AI agent", "agent ready", "API score", "Jentic", "API documentation", "Appear"],
  authors: [{ name: "Appear", url: "https://www.appear.sh" }],
  openGraph: {
    title: "Agent-Ready Score | Is Your API Ready for AI Agents?",
    description: "Free tool to measure your OpenAPI spec's readiness for AI agents. Based on the Jentic AI Readiness framework.",
    type: "website",
    url: "https://validator.appear.sh",
    siteName: "Appear",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agent-Ready Score | Appear",
    description: "Is your API ready for AI agents? Find out with our free OpenAPI validator.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body
        className={`antialiased`} // Use a basic class
      >
        <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
        >
            {children}
        </ThemeProvider>

        {/* --- Google Analytics --- */}
        {/* Conditionally render the GA component */}
        {process.env.NODE_ENV === 'production' && gaMeasurementId && (
            <GoogleAnalytics gaId={gaMeasurementId} />
        )}

        {/* --- Manual GA Implementation (Temporary Diagnostic) --- */}
        {/* REMOVED manual implementation block */}
        {/* --- End Manual GA Implementation --- */}
        <Analytics />
      </body>
    </html>
  );
}
