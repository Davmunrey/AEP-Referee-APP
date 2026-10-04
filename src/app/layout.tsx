import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { themeBootScript } from "@/lib/theme";
import { AuthFragmentHandler } from "@/components/auth/auth-fragment-handler";
import { ConfirmHost } from "@/components/ui/confirm-dialog";

// Geist: grotesca neutra y actual, con cifras tabulares de serie; sustituye a
// DM Sans + IBM Plex Mono, cuya mono de aire «terminal» envejecía la interfaz.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AEP Tarima",
  description:
    "Panel B2B de gestión de jueces para la Asociación Española de Powerlifting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: el script de arranque pone `data-theme` en
    // <html> antes de hidratar, a propósito.
    <html lang="es" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>
        <AuthFragmentHandler />
        {children}
        <ConfirmHost />
      </body>
    </html>
  );
}
