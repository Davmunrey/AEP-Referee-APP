import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["pdfkit", "pdfjs-dist"],
  // /docs lee CHANGELOG.md con fs en runtime (sección «Novedades»); sin esto,
  // el file tracing de Vercel no incluiría el fichero en el bundle serverless.
  outputFileTracingIncludes: {
    "/docs": ["./CHANGELOG.md"],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-dialog",
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      },
    ];

    // Las páginas reciben su CSP con nonce del middleware (src/lib/security/csp).
    // Las rutas de la API no pasan por él y conservan esta política fija: el
    // cuadrante imprimible es HTML servido desde la API, con un botón y un
    // script en línea, así que aquí sigue haciendo falta `'unsafe-inline'`.
    // La evaluación de texto como código (unsafe-eval) ya no: nadie la usa
    // fuera del servidor de desarrollo.
    const apiCsp =
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'";

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: apiCsp }],
      },
    ];
  },
};

export default nextConfig;
