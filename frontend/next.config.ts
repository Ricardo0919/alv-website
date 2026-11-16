import type { NextConfig } from "next";

// Si NEXT_PUBLIC_API_URL está vacío, el navegador llama a /api en el mismo
// dominio del frontend y Next.js lo reenvía al backend (API_PROXY_TARGET).
// En Docker: API_PROXY_TARGET=http://backend:8000 (se fija al construir la imagen).
const proxyTarget = (process.env.API_PROXY_TARGET || "http://127.0.0.1:8000").replace(/\/$/, "");
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
const isProd = process.env.NODE_ENV === "production";

// Política de seguridad de contenido: solo se cargan scripts, estilos e imágenes
// del propio sitio. Si alguien lograra inyectar HTML, el navegador bloquearía
// scripts externos y el envío de datos a otros dominios.
const csp = [
  "default-src 'self'",
  // Next.js inyecta scripts inline para hidratar la página
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${apiUrl ? ` ${new URL(apiUrl).origin}` : ""}`,
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Imagen de Docker mínima: solo el servidor y los archivos necesarios
  output: "standalone",
  // Django requiere la "/" final en sus rutas: evita que Next la quite
  skipTrailingSlashRedirect: true,
  // Permite abrir el servidor de desarrollo desde la red local (celular, otra laptop)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  async headers() {
    // En desarrollo la CSP rompería la recarga en caliente
    return isProd ? [{ source: "/:path*", headers: securityHeaders }] : [];
  },
  async rewrites() {
    if (apiUrl) return [];
    return [{ source: "/api/:path*", destination: `${proxyTarget}/api/:path*/` }];
  },
};

export default nextConfig;
