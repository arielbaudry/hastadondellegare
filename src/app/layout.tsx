import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hasta dónde llegaré — árbol genealógico familiar",
  description:
    "Árbol genealógico colaborativo de la familia: fotos, fechas, lugares y vínculos entre generaciones. Cargalo entre todos.",
  openGraph: {
    title: "Hasta dónde llegaré",
    description: "El árbol de la familia, cargado entre todos.",
    type: "website",
  },
  robots: { index: false, follow: false }, // datos de familia: fuera de buscadores
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c11" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
