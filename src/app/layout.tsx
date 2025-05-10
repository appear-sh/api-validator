import type { Metadata } from "next";
// Import the GoogleAnalytics component
import { GoogleAnalytics } from '@next/third-parties/google';
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/react"


export const metadata: Metadata = {
  title: "API Spec Validator | Appear",
  description: "Upload your API spec and see validation errors directly mapped to your code.",
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
