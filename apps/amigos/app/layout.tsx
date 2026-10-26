import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amigos de mierda',
  description: 'Un juego para gente que no quiere tanto a sus amigos. Una pregunta por día por WhatsApp; apostás qué contestó cada uno.',
  robots: process.env.BRUTAL_ENV === 'production' ? undefined : { index: false, follow: false },
  openGraph: { title: 'Amigos de mierda', description: 'Un juego para gente que no quiere tanto a sus amigos.', locale: 'es_AR', type: 'website' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#000000' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        <div className="wrap">
          <header className="top">
            <Link href="/" className="logo">AMIGOS DE MIERDA</Link>
            <nav className="nav" aria-label="Secciones">
              <Link href="/#como">Cómo se juega</Link>
              <Link href="/cartas">Cartas gratis</Link>
              <Link href="/#preguntas">Tus preguntas estúpidas</Link>
              <Link href="/#brutal">BRUTAL</Link>
            </nav>
          </header>
          {children}
          <footer>
            Amigos de mierda es un experimento de BRUTAL, hecho en Argentina. No está afiliado a nadie que te caiga bien.<br />
            Para mayores de 18. Escribí SALIR para irte y BORRAME para que borremos todo lo que jugaste.
          </footer>
        </div>
      </body>
    </html>
  );
}
