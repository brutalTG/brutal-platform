import Link from 'next/link';
import { briefs } from '@/content/briefs';

export default function Home() {
  const latest = briefs[0].meta;
  return (
    <main className="shell home">
      <p className="kicker">Inteligencia generacional</p>
      <h1>Lo que la generación que viene hace. No lo que dice.</h1>
      <p className="dek">BRUTAL lee a los argentinos de veinte años con juegos de cuatro minutos en el teléfono, y publica lo que encuentra cuando va contra lo que todos dan por sabido.</p>
      <div className="brief-list">
        <Link className="brief-card" href={latest.href ?? `/briefs/${latest.slug}`}>
          <div className="meta"><span>Último</span><span>{latest.kind}</span><span>{latest.date}</span></div>
          <h2>{latest.title}</h2>
          <p>{latest.dek}</p>
          <span className="go">Leer · {latest.minutes} min →</span>
        </Link>
      </div>
      <p className="dek" style={{ marginTop: 40, fontSize: 16 }}><Link href="/briefs">Todos los briefs →</Link></p>
    </main>
  );
}
