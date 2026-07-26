import type { Metadata, Viewport } from "next";
import InstallPrompt from "@/components/InstallPrompt";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // CRÍTICO: Evita que la app haga zoom al tocar rápido botones
  themeColor: "#ffffff",
};

export const metadata: Metadata = {
  title: "Stock Cantinas — Elche CF",
  description: "Sistema de gestión de inventario y ventas para cantinas del Elche CF",
  manifest: "/manifest.json",
  icons: {
    icon: "/android-chrome-192x192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Stock Cantinas",
    statusBarStyle: "default",
    //startupImage: [], //opcional
  },
  formatDetection: {
    telephone: false,
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Material Symbols Rounded: iconografía del panel de administración */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..600,0..1,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}
        suppressHydrationWarning={true}
      >
        <Providers>
          {children}
        </Providers>
        <InstallPrompt />
      </body>
    </html>
  );
}

