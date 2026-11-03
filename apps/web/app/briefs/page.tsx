import type { Metadata } from 'next';
import Link from 'next/link';
import { briefs } from '@/content/briefs';

export const metadata: Metadata = { title: 'Briefs', description: 'Black Briefs y notas de BRUTAL.' };

export default function Briefs() {
  return (
    <main className="shell index">
      <p className="kicker">Briefs</p>
      <h1>Una pregunta chica por vez.</h1>
      <p className="dek">Cada pieza sale de un Drop: un juego de cuatro minutos que contesta una sola pregunta que nadie se había hecho. Los Black Briefs son el informe completo; las notas, la lectura.</p>
      <div className="brief-list">
        {briefs.map(({ meta }) => (
          <Link key={meta.slug} className="brief-card" href={meta.href ?? `/briefs/${meta.slug}`} target={meta.href ? '_blank' : undefined} rel={meta.href ? 'noreferrer' : undefined}>
            <div className="meta"><span>{meta.kind}</span><span>{meta.date}</span><span>{meta.topics}</span></div>
            <h2>{meta.title}</h2>
            <p>{meta.dek}</p>
            <span className="go">Leer · {meta.minutes} min →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
