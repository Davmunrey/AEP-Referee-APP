import type { Metadata } from "next";
import { headers } from "next/headers";
import { Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { themeBootScript } from "@/lib/theme";
import { ConfirmHost } from "@/components/ui/confirm-dialog";
import { NONCE_HEADER } from "@/lib/security/csp";

// Archivo: grotesca pensada para deporte y datos (Omnibus-Type), con cifras
// tabulares y eje de anchura. El texto va a anchura normal; los títulos, algo
// ensanchados (`font-display` en globals.css), que es lo que les da el aire
// del logotipo de la AEP sin recurrir a cursivas. Sustituye a Geist, la
// grotesca que hoy lleva cualquier panel generado.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce de la CSP de esta petición (lo pone el middleware). Sin él, el
  // script de arranque del tema no se ejecutaría.
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    // suppressHydrationWarning: el script de arranque pone `data-theme` en
    // <html> antes de hidratar, a propósito.
    <html lang="es" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* suppressHydrationWarning: el navegador oculta el valor del nonce en
            el DOM (lo deja en ""), así que React vería un desajuste que no lo es. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${archivo.variable} ${geistMono.variable} antialiased`}>
        {children}
        <ConfirmHost />
      </body>
    </html>
  );
}
