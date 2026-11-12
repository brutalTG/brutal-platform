// ============================================================
// /bases — Bases y condiciones del sorteo
// TEXTO PROVISORIO: Nacho pasa el definitivo. Revisarlo con un abogado antes de lanzar el sorteo
// (sorteos sin obligación de compra; Ley 25.326 de datos personales).
// ============================================================

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Organizador",
    body: ["El sorteo lo organiza BRUTAL. Los datos del organizador (razón social, CUIT y domicilio) se completan en la versión definitiva de estas bases."],
  },
  {
    title: "Quién puede participar",
    body: [
      "Personas de 18 años o más que vivan en la República Argentina.",
      "Participar es gratis. No hay que comprar nada ni pagar nada para jugar ni para participar del sorteo.",
    ],
  },
  {
    title: "Cómo se participa",
    body: [
      "Jugando los Drops de BRUTAL sumás Golden Tickets. Cada 100 Golden Tickets equivalen a una chance en el sorteo, salvo que el Drop indique otra cantidad.",
      "Para que los tickets cuenten tenés que reclamarlos por WhatsApp desde la pantalla final del Drop. Los tickets que no se reclaman no participan.",
      "Por cada amigo que juegue un Drop con tu link y reclame sus tickets, sumás los tickets extra que indica la pantalla final.",
    ],
  },
  {
    title: "Premios y fecha del sorteo",
    body: [
      "El premio y la fecha del sorteo son los que se muestran en la pantalla final de cada Drop.",
      "El premio no se puede cambiar por dinero ni por otro premio.",
    ],
  },
  {
    title: "Ganadores",
    body: [
      "El sorteo se hace entre todas las chances acumuladas hasta la fecha del sorteo.",
      "Avisamos a quien gane por el mismo número de WhatsApp con el que reclamó los tickets. Si no responde dentro del plazo que se indique, se sortea de nuevo.",
      "Quien gane puede tener que mostrar un documento para confirmar su edad e identidad.",
    ],
  },
  {
    title: "Lo que nunca te vamos a pedir",
    body: ["BRUTAL no vende nada y nunca te va a pedir datos de tarjeta de crédito, claves ni pagos para participar ni para recibir un premio."],
  },
  {
    title: "Tus datos",
    body: [
      "Los datos que nos das se usan como se explica en la política de privacidad (brutal.lat/privacidad). Podés pedir ver, corregir o borrar tus datos escribiendo al WhatsApp de BRUTAL.",
    ],
  },
  {
    title: "Cambios",
    body: ["BRUTAL puede modificar estas bases por causas justificadas, avisándolo en este mismo lugar."],
  },
];

export default function BasesPage() {
  return (
    <div className="min-h-dvh bg-black px-5 py-10 text-white">
      <div className="mx-auto w-full max-w-[560px]">
        <p className="mb-8 font-['Silkscreen'] text-[11px] tracking-widest text-white/40">BRUTAL////////////////</p>
        <h1 className="mb-2 font-['Silkscreen'] text-[26px] leading-tight">BASES Y CONDICIONES</h1>
        <p className="mb-10 font-['Fira_Code'] text-[12px] text-white/50">Versión provisoria · noviembre de 2026</p>
        {SECTIONS.map((s) => (
          <section key={s.title} className="mb-8">
            <h2 className="mb-3 font-['Roboto'] text-[17px] font-extrabold">{s.title}</h2>
            {s.body.map((p) => (
              <p key={p} className="mb-2 font-['Roboto'] text-[15px] leading-relaxed text-white/80">{p}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
