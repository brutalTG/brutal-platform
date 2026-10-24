import type { Metadata, Viewport } from 'next';
import { Roboto, Fira_Code } from 'next/font/google';
import './globals.css';

// Las mismas fuentes que Drops: Roboto para todo, Fira Code para los contadores chicos.
const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700', '800', '900'], variable: '--sans' });
const fira = Fira_Code({ subsets: ['latin'], weight: ['500', '700'], variable: '--mono' });

export const metadata: Metadata = {
  title: 'PRESSURE',
  description: '¿Podés mentirle a una IA?',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#000000' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${roboto.variable} ${fira.variable}`}>
      <body>{children}</body>
    </html>
  );
}
