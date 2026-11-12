// ============================================================
// /privacidad — qué datos pedimos y qué hacemos con ellos
// Borrador para revisar con alguien que sepa de la Ley 25.326 antes de abrir a usuarios reales.
// ============================================================

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "Qué es BRUTAL",
    body: [
      "BRUTAL es un juego por WhatsApp para personas de 15 a 35 años. Detrás del juego hay investigación: con las respuestas armamos estudios sobre cómo piensan y deciden los jóvenes en Argentina.",
    ],
  },
  {
    title: "Qué datos pedimos",
    body: [
      "Tu número de WhatsApp, porque es el canal por el que jugás.",
      "Los datos del perfil: apodo, edad, género y dónde vivís.",
      "Lo que contestás en cada Drop y cuánto tardás en contestar.",
    ],
  },
  {
    title: "Para qué los usamos",
    body: [
      "Para que puedas jugar, sumar Golden Tickets y aparecer en el ranking con tu apodo.",
      "Para estudios sobre jóvenes. En los estudios las respuestas van siempre agrupadas: nunca aparece tu nombre, tu apodo ni tu teléfono, y nadie puede saber qué contestaste vos.",
      "Para avisarte por WhatsApp cuando hay un Drop nuevo o cómo quedaste en el ranking.",
    ],
  },
  {
    title: "Qué no hacemos",
    body: [
      "No vendemos ni compartimos tu teléfono ni tus datos personales.",
      "No publicamos tus respuestas individuales.",
    ],
  },
  {
    title: "Dónde se guardan",
    body: [
      "En servidores de proveedores de infraestructura (Supabase y Vercel), que pueden estar fuera de Argentina. Tu teléfono se guarda separado de tus respuestas.",
    ],
  },
  {
    title: "Menores de 18",
    body: [
      "Si tenés entre 15 y 17 años podés jugar, pero solo recibís Golden Tickets: nunca plata ni premios en efectivo.",
    ],
  },
  {
    title: "Tus derechos",
    body: [
      "Podés pedir ver, corregir o borrar tus datos cuando quieras, escribiendo al mismo número de WhatsApp de BRUTAL.",
      "Para dejar de recibir mensajes, escribí BAJA.",
      "La Agencia de Acceso a la Información Pública es el organismo que controla el cumplimiento de la Ley 25.326 de Protección de Datos Personales.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-black px-5 py-10 text-white">
      <div className="mx-auto w-full max-w-[560px]">
        <p className="mb-8 font-['Silkscreen'] text-[11px] tracking-widest text-white/40">BRUTAL////////////////</p>
        <h1 className="mb-2 font-['Silkscreen'] text-[26px] leading-tight">POLÍTICA DE PRIVACIDAD</h1>
        <p className="mb-10 font-['Fira_Code'] text-[12px] text-white/50">Última actualización: noviembre de 2026</p>
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
