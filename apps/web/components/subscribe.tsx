// Caja de suscripción al canal de WhatsApp. Va al cierre de cada brief.
// Mismo link que el BB025. Sin número, abre WhatsApp para elegir a quién mandarlo: cuando exista el número del canal, va acá.
export const SUBSCRIBE_URL = 'https://wa.me/?text=Quiero%20recibir%20el%20pr%C3%B3ximo%20Black%20Brief%20de%20BRUTAL';

export function Subscribe() {
  return (
    <aside className="shell subscribe" aria-labelledby="subscribe-title">
      <div>
        <span>Canal de WhatsApp</span>
        <h3 id="subscribe-title">Recibí el próximo Black Brief.</h3>
        <p>Una edición breve, cuando haya algo que valga la pena publicar. Sin grupos. Sin ruido.</p>
      </div>
      <a href={SUBSCRIBE_URL} target="_blank" rel="noreferrer">Suscribirme por WhatsApp</a>
    </aside>
  );
}
