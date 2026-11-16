import type { MetadataRoute } from "next";

/**
 * Manifiesto de la PWA: permite "Instalar app" / "Agregar a pantalla de inicio"
 * desde Chrome, con su propio ícono y ventana sin barra del navegador.
 * Next.js lo publica en /manifest.webmanifest y lo enlaza automáticamente.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "El Migajero",
    short_name: "Migajero",
    description: "De migaja en migaja se hace un bolillo",
    lang: "es-MX",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF8DC",
    theme_color: "#8B4513",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Registrar migajas", short_name: "Registrar", url: "/log", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Amigos", url: "/amigos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Notificaciones", url: "/notificaciones", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
