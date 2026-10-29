// Piezas con las que se arma una nota o un Black Brief. Todas son de solo lectura.
import type { ReactNode } from 'react';

export function BriefHead({ kicker, title, dek, date, minutes, draft }: { kicker: string; title: ReactNode; dek: string; date: string; minutes: number; draft?: string }) {
  return (
    <div className="col head">
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      <p className="dek">{dek}</p>
      <div className="byline"><span>Por <b>BRUTAL</b></span><span>{date}</span><span>{minutes} minutos</span></div>
      {draft && <span className="note">{draft}</span>}
    </div>
  );
}

/** Una pantalla del Drop, tal como la vio el que jugó. */
export function Screen({ n, total, question, options, chosen, caption }: { n: number; total: number; question: string; options: string[]; chosen?: number; caption?: string }) {
  return (
    <figure className="screen">
      <div className="top"><span>Pantalla {n} de {total}</span><span>Toque para elegir</span></div>
      <p className="q">{question}</p>
      <div className="btns">{options.map((o, i) => <span key={o} className={i === chosen ? 'hi' : undefined}>{o}</span>)}</div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Lo que dijeron, con apodo. */
export function Voices({ items }: { items: { quote: string; who: string }[] }) {
  return (
    <div className="voices">
      {items.map((v) => <div key={v.quote}><q>{v.quote}</q><span>{v.who}</span></div>)}
    </div>
  );
}

export function Sources({ title = 'Lo que hay detrás', items }: { title?: string; items: ReactNode[] }) {
  return (
    <div className="col sources">
      <h3>{title}</h3>
      <ol>{items.map((it, i) => <li key={i}>{it}</li>)}</ol>
    </div>
  );
}
