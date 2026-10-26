import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PRESSURE',
  description: '¿Podés mentirle a una IA?',
  robots: { index: false, follow: false },
  // iPhone: desde "Agregar a inicio" abre sin barras de Safari y con la barra de estado sobre el juego.
  appleWebApp: { capable: true, title: 'PRESSURE', statusBarStyle: 'black-translucent' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#000000' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        {/* Las mismas fuentes que Drops (src/styles/fonts.css). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;700&family=Roboto:wght@400;500;700;800;900&family=Silkscreen:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
