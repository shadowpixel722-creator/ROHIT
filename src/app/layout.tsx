import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { themeInitScript, TimeZoneCookie } from "@/components/theme";
import "./globals.css";

const sans = Hanken_Grotesk({ variable: "--font-app-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-app-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Class Notebooks", template: "%s · Class Notebooks" },
  description: "Share, approve and learn from your class notebooks together.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#01030a" },
    { media: "(prefers-color-scheme: dark)", color: "#01030a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${sans.variable} ${mono.variable} min-h-dvh antialiased`}>
        <TimeZoneCookie />
        {children}
      </body>
    </html>
  );
}
