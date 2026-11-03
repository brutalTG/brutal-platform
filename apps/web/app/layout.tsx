import type { Metadata } from 'next';
import { Inter, Geist } from 'next/font/google';
import './globals.css';
import { Masthead } from '@/components/masthead';
import { Footer } from '@/components/footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });

const isTest = process.env.BRUTAL_ENV !== 'production';

export const metadata: Metadata = {
  title: { default: 'BRUTAL', template: '%s · BRUTAL' },
  description: 'Inteligencia generacional. Lo que la generación que viene hace, no lo que dice.',
  robots: isTest ? { index: false, follow: false } : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${geist.variable}`}>
      <body>
        <Masthead />
        {children}
        <Footer />
      </body>
    </html>
  );
}
