import Link from 'next/link';
import { cards, playLink, type Card } from '@/lib/site';

export const revalidate = 600;

const FAQ: [string, string][] = [
  ['¿Cuánto sale?', 'Nada. No queremos tu plata. Queremos saber qué contestás cuando nadie te mira, que es mucho más valioso y además lo regalás.'],
  ['¿Hay que bajar algo?', 'No. Es un número de WhatsApp. Le escribís, te pregunta cómo se llama tu grupo y arrancás. Lo único que se baja es tu autoestima.'],
  ['¿El bot entra a mi grupo?', 'No. Cada uno juega por privado con el bot. Al grupo solo llega lo que ustedes peguen: la pregunta del día y la grilla de la noche.'],
  ['¿Quién escribe las preguntas?', 'Ustedes. Cada día le toca a uno. BRUTAL le propone tres dilemas, pero puede escribir el que quiera. Los mejores son los que nadie de afuera entendería.'],
  ['¿Cómo se apuesta, en serio?', 'Después de contestar, el bot te nombra a cada amigo y le decís qué creés que eligió: A o B. Un toque por amigo. Cada acierto suma 10. Todos apuestan por todos, por privado; el grupo solo ve la grilla de la noche.'],
  ['¿Mis amigos ven lo que contesté?', 'Sí. Ese es el juego. Si no querés que tus amigos sepan lo que pensás, quizás el problema no es el juego.'],
  ['¿Y los audios?', 'Cada día te toca un amigo y le mandás un audio de diez segundos diciéndole qué contestó y por qué. Lo escucha solo esa persona. Si le pegaste, suma.'],
  ['¿Qué hacen con lo que contesto?', 'BRUTAL lo usa para investigar cómo piensa tu generación. Sin tu nombre y sin tu número: tus respuestas se juntan con las de miles de personas y salen como datos, nunca como vos. Más abajo está todo.'],
  ['¿Cómo me voy?', 'Escribís SALIR y no te escribimos más. Si escribís BORRAME, borramos tus respuestas, tus apuestas y tus audios. Como si nunca te hubieran conocido.'],
  ['¿Por qué se llama así?', 'Porque tus amigos son de mierda. Los nuestros también. Es lo más lindo que tienen.'],
  ['¿Es para menores?', 'No. Es para mayores de 18. Las preguntas son lo que son.'],
];

// Reseñas de medios inventados: el chiste es de Cards Against Humanity. Ninguna es de un medio real.
const REVIEWS: [string, string][] = [
  ['Un juego diseñado para que pierdas un amigo por día. Funciona.', 'The Lowband Review (medio inventado)'],
  ['Lo probamos en la redacción. Ya no nos hablamos. Cinco estrellas.', 'Groupchat Quarterly (medio inventado)'],
  ['No entendemos a quién se le ocurrió esto. Tampoco pudimos dejar de jugar.', 'The Weekly Algorithm (medio inventado)'],
];

// La grilla de la noche, con un grupo de ejemplo: fila = el que apostó, columna = por quién apostó.
const PEOPLE = ['Fede', 'Lu', 'Juan', 'Mati', 'Sofi'];
const SAID = ['LO LEE', 'LO LEE', 'NO', 'LO LEE', 'NO'];
const HIT: (boolean | null)[][] = [
  [null, true, true, false, false],
  [true, null, true, true, false],
  [false, false, null, false, false],
  [true, false, true, null, false],
  [true, true, true, true, null],
];

function Reveal() {
  return (
    <figure className="reveal" aria-label="Ejemplo de la grilla de la noche">
      <p className="rv-top">LOSPIBES · día 6</p>
      <p className="rv-q">Existe un grupo de WhatsApp de tus amigos sin vos. ¿Lo leés?</p>
      <div className="rv-grid" role="table">
        <div role="row" className="rv-row">
          <span role="columnheader" className="rv-corner">apostó ↓ · dijo →</span>
          {PEOPLE.map((p, i) => (<span role="columnheader" key={p} className="rv-col">{p}<em className={SAID[i] === 'NO' ? 'no' : 'yes'}>{SAID[i]}</em></span>))}
        </div>
        {PEOPLE.map((p, r) => (
          <div role="row" className="rv-row" key={p}>
            <span role="rowheader" className="rv-name">{p}</span>
            {HIT[r].map((h, c) => (
              <span role="cell" key={c} className={h === null ? 'rv-cell self' : h ? 'rv-cell hit' : 'rv-cell miss'}>{h === null ? '—' : h ? 'SÍ' : 'NO'}</span>
            ))}
          </div>
        ))}
      </div>
      <figcaption className="rv-foot">
        <span><b className="acc">Sofi</b> leyó a todos. Nadie leyó a Sofi.</span>
        <span><b className="dim">Juan</b> no tiene idea de con quién sale los viernes.</span>
      </figcaption>
    </figure>
  );
}

function CardView({ c }: { c: Card }) {
  return (
    <article className="card black">
      <div>
        <div className="q">{c.prompt}</div>
        {c.detail && <div className="d">{c.detail}</div>}
      </div>
      <div>
        <div className="opts"><span>A · {c.option_a}</span><span>B · {c.option_b}</span></div>
        <div className="brand"><span>Amigos de mierda</span><span>BRUTAL</span></div>
      </div>
    </article>
  );
}

export default async function Home() {
  const link = playLink();
  const sample = (await cards(60)).slice(0, 6);
  return (
    <main>
      <section className="hero">
        <p className="wa-badge">Un juego de WhatsApp</p>
        <h1>Amigos de mierda.</h1>
        <p className="tag">Un juego para gente que no quiere tanto a sus amigos.</p>
        <ol className="quick">
          <li><b>Le escribís al bot</b> y le decís quiénes son tus amigos.</li>
          <li><b>Todos los días, un dilema.</b> Contestás A o B y adivinás qué dijo cada uno.</li>
          <li><b>A la noche, el veredicto:</b> quién te conoce y quién no tiene idea.</li>
        </ol>
        <div className="cta-row">
          {link
            ? <a className="btn primary" href="/jugar">Jugar gratis por WhatsApp</a>
            : <span className="btn ghost" aria-disabled="true">Muy pronto</span>}
          <Link className="btn ghost" href="/#como">Cómo se juega</Link>
        </div>
        <p className="fine">No hay app. No hay registro. Es un número de WhatsApp: le escribís y en un minuto estás jugando con tu grupo. El bot nunca entra a tu grupo.</p>
      </section>

      <section className="block" aria-labelledby="dijeron">
        <p className="eyebrow" id="dijeron">Lo que dijeron de nosotros</p>
        <div className="reviews">
          {REVIEWS.map(([quote, src]) => (
            <figure key={src} className="rv">
              <blockquote>“{quote}”</blockquote>
              <figcaption>{src}</figcaption>
            </figure>
          ))}
        </div>
        <p className="review-src">Medios inventados. Ningún medio de verdad escribió sobre nosotros todavía. Cuando alguno diga que esto es una pelotudez, lo ponemos acá, bien grande.</p>
      </section>

      <section className="block" id="como" aria-labelledby="como-h">
        <p className="eyebrow">Cómo se juega</p>
        <h2 id="como-h">Todo pasa en tu chat con el bot. El grupo solo recibe el veredicto.</h2>
        <div className="steps">
          <div className="card white"><div className="n">18 h</div><div className="t">A uno del grupo le toca preguntar. BRUTAL le propone 3 dilemas. O escribe el que quiera.</div></div>
          <div className="card black"><div className="n">21 h</div><div className="t">El bot se lo manda a cada uno, por privado. Contestás A o B. Nadie ve lo tuyo.</div></div>
          <div className="card white"><div className="n">+1 min</div><div className="t">Te pregunta qué contestó cada uno de tus amigos. Un toque por amigo. Eso es apostar.</div></div>
          <div className="card black"><div className="n">23 h</div><div className="t">Llega la grilla: quién leyó a quién. Cada acierto suma 10. La pegás en el grupo y arde.</div></div>
        </div>

        <div className="howto">
          <div className="chat" aria-label="Ejemplo de la apuesta en el chat con el bot">
            <p className="chat-head">Amigos de mierda · bot</p>
            <div className="msg in">Pregunta de Fede: Existe un grupo de WhatsApp de tus amigos sin vos. Te llega el link. Podés leerlo una sola vez.<br/><br/>A · Lo leo<br/>B · No lo abro</div>
            <div className="msg out">A</div>
            <div className="msg in">Anotado. Ahora apostá por los demás. Cada acierto suma.</div>
            <div className="msg in">¿Qué dijo Lu?<br/>A · Lo leo<br/>B · No lo abro</div>
            <div className="msg out">B</div>
            <div className="msg in">¿Qué dijo Juan?<br/>A · Lo leo<br/>B · No lo abro</div>
            <div className="msg out">A</div>
            <div className="msg in">Listo. A las 23 te digo quién te conoce.</div>
          </div>
          <div className="howto-text">
            <p><strong>Apostar es adivinar.</strong> Después de contestar, el bot te nombra a cada amigo y le decís qué creés que eligió. Con seis amigos son cinco toques.</p>
            <p><strong>Todos apuestan por todos.</strong> Y todos son apostados. Por eso la grilla de la noche dice quién conoce a quién y quién vive en otro planeta.</p>
            <p><strong>A veces hay víctima.</strong> El que pregunta puede elegir a uno: ese día todos apuestan solo por esa persona, y el acierto vale el doble.</p>
            <p><strong>El primer día es distinto.</strong> El que arma el grupo contesta y apuesta por todos antes que nadie. Pega el link en el grupo y cada uno, al contestar, se entera en el acto si lo leyó.</p>
          </div>
        </div>
      </section>

      <section className="block" aria-labelledby="noche-h">
        <p className="eyebrow">A las 23</p>
        <h2 id="noche-h">Esto es lo que se pega en el grupo.</h2>
        <Reveal />
      </section>

      <section className="block" id="dilemas" aria-labelledby="cartas-h">
        <p className="eyebrow">Los dilemas</p>
        <h2 id="cartas-h">BRUTAL te propone tres. Vos podés escribir el que quieras.</h2>
        <p className="lead">Cuando te toca preguntar, el bot te ofrece tres dilemas de la casa. Si ninguno te sirve, escribís el tuyo: una pregunta, dos opciones, y si querés una víctima. El mejor dilema es el que solo tu grupo entiende.</p>
        <div className="cards">{sample.map((c) => <CardView key={c.id} c={c} />)}</div>
        <div className="howto own">
          <div className="chat" aria-label="Ejemplo: escribir tu propio dilema">
            <p className="chat-head">Amigos de mierda · bot</p>
            <div className="msg in">Hoy preguntás vos. Sale a las 21 con tu nombre.<br/><br/>Mandame un dilema con dos opciones envenenadas, o elegí uno:<br/><br/>1. La empresa de tu viejo<br/>2. El grupo sin vos<br/>3. La beca de 10 años<br/><br/>Respondé 1, 2 o 3, escribí el tuyo, o IDEAS para otras.</div>
            <div className="msg out">Mati te pide que lo cubras con la novia. ¿Lo cubrís?</div>
            <div className="msg in">Bien. ¿Opción A? Cortita, hasta 40 letras.</div>
            <div className="msg out">Lo cubro</div>
            <div className="msg in">¿Y la opción B?</div>
            <div className="msg out">Le cuento todo</div>
            <div className="msg in">¿Querés marcar una víctima? Todas las apuestas van a esa persona y valen doble.</div>
            <div className="msg out">NO</div>
            <div className="msg in">Listo. Sale a las 21 con tu nombre. Ya podés ir sufriendo.</div>
          </div>
        </div>
      </section>

      <section className="block" id="preguntas" aria-labelledby="faq-h">
        <p className="eyebrow">Tus preguntas estúpidas</p>
        <h2 id="faq-h">Respondidas con la paciencia que no tenemos.</h2>
        <div className="faq">
          {FAQ.map(([q, a]) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
        </div>
      </section>

      <section className="block brutal" id="brutal" aria-labelledby="brutal-h">
        <p className="eyebrow">Qué es BRUTAL</p>
        <h2 id="brutal-h">Sí, esto es un experimento.</h2>
        <p><strong>BRUTAL es un laboratorio que estudia a la generación que nadie entiende.</strong> Amigos de mierda es uno de sus experimentos: en vez de mandarte una encuesta que no ibas a contestar, te damos un juego que sí.</p>
        <p>Lo que contestás, lo que apostás sobre tus amigos y lo que les decís en los audios se guarda <strong>sin tu nombre ni tu número</strong> y se junta con lo de miles de personas de entre 18 y 30 años. De ahí salen informes sobre cómo piensa esta generación: qué la divide, qué cree que piensan los demás y en qué se equivoca.</p>
        <p>Nadie va a leer tu respuesta con tu nombre al lado. Tus amigos, sí. Ese es el juego.</p>
        <div className="cta-row">
          {link && <a className="btn primary" href="/jugar">Jugar con mi grupo</a>}
          <a className="btn ghost" href="https://brutal.lat" rel="noopener">brutal.lat</a>
        </div>
      </section>
    </main>
  );
}
