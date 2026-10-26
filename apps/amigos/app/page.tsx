import Link from 'next/link';
import { cards, playLink, type Card } from '@/lib/site';

export const revalidate = 600;

const FAQ: [string, string][] = [
  ['¿Cuánto sale?', 'Nada. No queremos tu plata. Queremos saber qué contestás cuando nadie te mira, que es mucho más valioso y además lo regalás.'],
  ['¿Hay que bajar algo?', 'No. Es un número de WhatsApp. Le escribís, te pregunta cómo se llama tu grupo y arrancás. Lo único que se baja es tu autoestima.'],
  ['¿Cómo se juega, en serio?', 'Una pregunta por día. Contestás A o B. Después apostás qué contestó cada uno de tus amigos. A la noche te llega quién te conoce y quién no tiene idea. Cada día pregunta uno distinto del grupo, y la puede escribir él.'],
  ['¿Mis amigos ven lo que contesté?', 'Sí. Ese es el juego. Si no querés que tus amigos sepan lo que pensás, quizás el problema no es el juego.'],
  ['¿Y los audios?', 'Cada día te toca un amigo y le mandás un audio de diez segundos diciéndole qué contestó y por qué. Lo escucha solo esa persona. Si le pegaste, suma.'],
  ['¿Qué hacen con lo que contesto?', 'BRUTAL lo usa para investigar cómo piensa tu generación. Sin tu nombre y sin tu número: tus respuestas se juntan con las de miles de personas y salen como datos, nunca como vos. Más abajo está todo.'],
  ['¿Cómo me voy?', 'Escribís SALIR y no te escribimos más. Si escribís BORRAME, borramos tus respuestas, tus apuestas y tus audios. Como si nunca te hubieran conocido.'],
  ['¿Por qué se llama así?', 'Porque tus amigos son de mierda. Los nuestros también. Es lo más lindo que tienen.'],
  ['¿Es para menores?', 'No. Es para mayores de 18. Las preguntas son lo que son.'],
  ['¿Lo puedo jugar en un asado, sin celular?', 'Sí. Las cartas están gratis para imprimir. Recortás, repartís y discuten hasta que alguien se va ofendido.'],
];

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
        <h1>Amigos de mierda.</h1>
        <p className="tag">Un juego para gente que no quiere tanto a sus amigos.</p>
        <div className="cta-row">
          {link
            ? <a className="btn primary" href="/jugar">Jugar gratis por WhatsApp</a>
            : <span className="btn ghost" aria-disabled="true">Muy pronto</span>}
          <Link className="btn ghost" href="/cartas">Imprimir las cartas</Link>
        </div>
        <p className="fine">No hay app. No hay registro. Le escribís a un número y en un minuto estás jugando con tu grupo.</p>
      </section>

      <section className="block" aria-labelledby="dijeron">
        <p className="eyebrow" id="dijeron">Lo que dijeron de nosotros</p>
        <p className="review">Todavía nadie escribió sobre nosotros.</p>
        <p className="review-src">Cuando un medio importante diga que esto es una pelotudez, lo vamos a poner acá, bien grande.</p>
      </section>

      <section className="block" id="como" aria-labelledby="como-h">
        <p className="eyebrow">Cómo se juega</p>
        <h2 id="como-h">Tres reglas. Ninguna te va a salvar.</h2>
        <div className="steps">
          <div className="card white"><div className="n">1</div><div className="t">Una pregunta por día. Contestás A o B.</div></div>
          <div className="card black"><div className="n">2</div><div className="t">Apostás qué contestó cada uno de tus amigos.</div></div>
          <div className="card white"><div className="n">3</div><div className="t">A la noche, quién te conoce y quién no tiene idea.</div></div>
        </div>
      </section>

      <section className="block" aria-labelledby="cartas-h">
        <p className="eyebrow">Algunas cartas</p>
        <h2 id="cartas-h">Elegí. Las dos te van a costar algo.</h2>
        <div className="cards">{sample.map((c) => <CardView key={c.id} c={c} />)}</div>
        <div className="cta-row"><Link className="btn ghost" href="/cartas">Ver todas e imprimir</Link></div>
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
