import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google"; // Temporarily commented out
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"

// const geistSans = Geist({ // Temporarily commented out
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({ // Temporarily commented out
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "API Spec Validator | Appear",
  description: "Upload your API spec and see validation errors directly mapped to your code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body
        // className={`${geistSans.variable} ${geistMono.variable} antialiased`} // Temporarily commented out
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
      </body>
    </html>
  );
}
