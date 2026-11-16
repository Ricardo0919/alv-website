import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Background from "../components/Background";
import { FeedbackProvider } from "../components/feedback/FeedbackProvider";
import { AuthProvider } from "../lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Proyecto ALV: El Migajero",
  description: "De migaja en migaja se hace un bolillo",
  applicationName: "El Migajero",
  // iPhone: "Agregar a pantalla de inicio" abre como app (sin barra de Safari)
  appleWebApp: { capable: true, title: "Migajero", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Ocupa toda la pantalla en celulares con notch / isla
  viewportFit: "cover",
  themeColor: "#8B4513",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} antialiased`}>
        <Background />
        <FeedbackProvider>
          <AuthProvider>{children}</AuthProvider>
        </FeedbackProvider>
      </body>
    </html>
  );
}
