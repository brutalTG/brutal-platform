import { cards } from '@/lib/site';
import { PrintButton } from './print';

export const revalidate = 600;
export const metadata = { title: 'Cartas gratis · Amigos de mierda' };

export default async function Cartas() {
  const list = await cards(200);
  return (
    <main>
      <section className="hero no-print">
        <h1>Las cartas. Gratis.</h1>
        <p className="tag">Imprimí, recortá y jugá en el asado. Uno lee la carta, todos eligen A o B en secreto, y antes de mostrar cada uno apuesta qué eligió el de al lado.</p>
        <div className="cta-row"><PrintButton /></div>
        <p className="fine">Gratis para jugar y compartir. No para vender.</p>
      </section>
      <div className="cards">
        {list.map((c) => (
          <article key={c.id} className="card black">
            <div>
              <div className="q">{c.prompt}</div>
              {c.detail && <div className="d">{c.detail}</div>}
            </div>
            <div>
              <div className="opts"><span>A · {c.option_a}</span><span>B · {c.option_b}</span></div>
              <div className="brand"><span>Amigos de mierda</span><span>BRUTAL</span></div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
