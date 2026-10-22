import type { Metadata, Viewport } from 'next';
import { Inter, Anton } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--sans' });
const anton = Anton({ subsets: ['latin'], weight: '400', variable: '--display' });

export const metadata: Metadata = {
  title: 'PRESSURE',
  description: 'Una máquina. Diez preguntas. Tres mentiras.',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#050505' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${anton.variable}`}>
      <body>{children}</body>
    </html>
  );
}
