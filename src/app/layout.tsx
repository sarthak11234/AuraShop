import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import { Inter } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import "./master.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ViewTransitionProvider } from "@/components/providers/ViewTransitionProvider";
import { CartSidebar } from "@/components/cart/CartSidebar";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VEXO | Futuristic E-Commerce",
  description: "Experience the future of shopping with VEXO.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXTAUTH_URL ??
      "https://vexo.store",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink-primary relative antialiased">
        {/* Global Textures */}
        <div className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.03] scanlines" />
        <div className="fixed inset-0 pointer-events-none z-[9998] opacity-[0.15] grain" />
        
        <Providers>
          <ViewTransitionProvider>
            <Header />
            <CartSidebar />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </ViewTransitionProvider>
        </Providers>
      </body>
    </html>
  );
}
