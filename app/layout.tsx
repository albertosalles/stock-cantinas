import type { Metadata, Viewport } from "next";
import InstallPrompt from '@/components/InstallPrompt';
import { Inter } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.variable}>
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}

