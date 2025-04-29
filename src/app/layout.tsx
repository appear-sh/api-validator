import type { Metadata } from "next";
// Remove unused Script import if no other scripts rely on it.
// import Script from 'next/script'; 
import { GoogleAnalytics } from '@next/third-parties/google'
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"


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
        {/* Removed old script implementation */}
        {/* Conditionally render the new GA component */}
        {process.env.NODE_ENV === 'production' && gaMeasurementId && (
            <GoogleAnalytics gaId={gaMeasurementId} />
        )}
      </body>
    </html>
  );
}
