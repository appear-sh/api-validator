import type { Metadata } from "next";
import Script from 'next/script';
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
        {process.env.NODE_ENV === 'production' && gaMeasurementId && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            />
            <Script
              id="google-analytics"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());

                  gtag('config', '${gaMeasurementId}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}
        {/* --- End Google Analytics --- */}
      </body>
    </html>
  );
}
