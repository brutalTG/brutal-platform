// Lo que se le pasa a la IA y cómo tiene que escribir. Sin base de datos.
import type { Block } from './results';

export type ReportKind = 'findings' | 'black_brief' | 'post' | 'note';
export const KIND_LABEL: Record<ReportKind, string> = { findings: 'Hallazgos', black_brief: 'Black Brief', post: 'Pieza para redes', note: 'Nota' };
export const STATUS_LABEL: Record<string, string> = { draft: 'Borrador', final: 'Listo', published: 'Publicado', archived: 'Archivado' };

const COMMON = `Escribís para BRUTAL, plataforma de inteligencia sobre la Gen Z argentina. Español rioplatense, directo, sin celebración ni adjetivos sobre el propio trabajo.
Reglas duras:
- Nunca inventes datos, voces ni porcentajes. Solo usás los números que vienen en el JSON.
- Cada número va con su vara en la misma oración (n, sobre cuántos, o contra qué grupo).
- Con menos de 30 respuestas en total o de 10 por grupo, decilo: es una pista, no un hallazgo.
- Separá lo que muestran los datos de lo que interpretás.
- Las trampas falladas ya están fuera de los números. En el detector de voz, cuando alguien mintió en una pregunta de dos opciones, se cuenta su respuesta verdadera; "lo que dijeron vs lo que es" muestra la distancia.
- La latencia mediana por respuesta indica duda: más lenta = más costo de responder.
- Markdown simple. Empezá con un título "# ...".`;

export const GUIDE: Record<Exclude<ReportKind, 'note'>, string> = {
  findings: `${COMMON}
Tarea: leer los resultados de un experimento contra su tesis (si la hay) y dejar un borrador de hallazgos para el equipo.
Estructura:
# Título (un sustantivo o binomio corto que nombre lo que apareció)
**En una línea:** qué encontramos.
## Contra la tesis
¿Se confirma, se refuta o no alcanza? Usá la regla de decisión si viene. Si no hay tesis, decí qué tesis sugieren los datos.
## Lo que aparece
3 a 6 hallazgos. Cada uno: el dato (con n), la lectura, y si es firme o pista. Priorizá cruces y diferencias entre grupos sobre distribuciones generales. Contradicciones entre cartas de un par de señal y "lo que dijeron vs lo que es" valen oro.
## Lo que no sabemos
Límites de la muestra, cartas que no funcionaron (todos igual, muchos abandonos o trampas), qué preguntaríamos en el próximo experimento.
## Para seguir
2 o 3 ideas concretas de próximos Drops o cartas.`,
  black_brief: `${COMMON}
Tarea: a partir de hallazgos ya editados por el equipo, escribir el borrador de un Black Brief (lectura narrativa con señal dura, para que un CMO sienta algo, no solo entienda).
Reglas de BRUTAL:
- El título es un sustantivo o binomio de 2 a 4 palabras que no existía antes.
- La tesis completa está dicha antes de la palabra 50.
- 5 movimientos o menos, cada uno con nombre propio. Nada de "Qué encontramos / Por qué importa" repetido.
- Cada número tiene una lectura contraintuitiva; el cruce vale más que la distribución.
- La palabra "nodo" no aparece. Se dice "ellos", "los de veintitrés", etc.
- No recomienda: muestra la fractura y el costo de cada lado.
- No halaga ni condena a la generación: es espejo, no amigo ni padre.
- Si faltan voces textuales del panel, dejá marcado [VOZ: inicial, edad, provincia] donde irían, sin inventarlas.
- Cierre que le da vuelta el instrumento al cliente.
- Máximo ~1500 palabras.`,
  post: `${COMMON}
Tarea: a partir de hallazgos ya editados, escribir 3 opciones de pieza pública para redes de BRUTAL Media (carrusel o post).
Reglas: cultura, no divulgación. Nada de "El 67% de la Gen Z prefiere...". Provoca, instala conversación, tiene posición. No explica la metodología.
Para cada opción: ## Opción N — gancho (una línea), texto de 3 a 6 placas o líneas, y el dato que la sostiene (con n) al final en chico.`,
};

/** Lo mínimo que necesita la IA: preguntas, repartos, cortes que se separan, pares y la tesis. */
export function compactForAi(x: { name: string; app: string; study: any; blocks: Block[]; byGender: Block[]; byZone: Block[]; pairs: unknown[] }) {
  const spread = (b: Block) => {
    const out: { respuesta: string; grupo_alto: string; pct_alto: number; grupo_bajo: string; pct_bajo: number }[] = [];
    for (const r of b.rows) {
      const gs = b.groups.filter((g) => g.n >= 3);
      if (gs.length < 2) continue;
      const vals = gs.map((g) => ({ g: `${g.name} (n=${g.n})`, p: r.byGroup[g.name]?.pct ?? 0 }));
      const hi = vals.reduce((a, c) => (c.p > a.p ? c : a)), lo = vals.reduce((a, c) => (c.p < a.p ? c : a));
      if (hi.p - lo.p >= 15) out.push({ respuesta: r.label, grupo_alto: hi.g, pct_alto: hi.p, grupo_bajo: lo.g, pct_bajo: lo.p });
    }
    return out;
  };
  const find = (list: Block[], key: string) => list.find((b) => b.key === key);
  return {
    experimento: x.name,
    tipo: x.app === 'pressure' ? 'detector de mentiras por voz' : 'Drop (cartas en el teléfono)',
    estudio: x.study ? { nombre: x.study.name, tesis: x.study.thesis, pregunta: x.study.question, regla_de_decision: x.study.decision_rule } : null,
    preguntas: x.blocks.map((b) => ({
      pregunta: b.title,
      ...(b.subtitle ? { contexto: b.subtitle } : {}),
      n: b.n,
      ...(b.lied ? { mintieron: b.lied } : {}),
      ...(b.mean != null ? { promedio: b.mean } : {}),
      respuestas: b.rows.map((r) => ({ r: r.label, pct: r.pct, n: r.n, latencia_mediana_s: r.medianMs == null ? null : Math.round(r.medianMs / 100) / 10 })),
      cortes_que_se_separan: {
        edad: spread(b),
        genero: spread(find(x.byGender, b.key) ?? b),
        zona: spread(find(x.byZone, b.key) ?? b),
      },
      ...(b.statedVsTruth ? { dijeron_vs_verdad: b.statedVsTruth } : {}),
      ...(b.transcripts ? { frases: b.transcripts.slice(0, 8) } : {}),
    })),
    pares_de_senal: x.pairs,
  };
}
