// Reglas puras del juego: hora local, lectura de respuestas, puntaje, objetivos y etiquetas.
import type { Answer, Bet, Choice, Member, PointRow } from './types.ts';

// ---------- Hora de Buenos Aires (UTC-3 fijo, sin horario de verano) ----------
const OFFSET_MS = 3 * 3600_000;

export function local(d: Date) {
  const t = new Date(d.getTime() - OFFSET_MS);
  return { date: t.toISOString().slice(0, 10), hour: t.getUTCHours(), minute: t.getUTCMinutes(), dow: t.getUTCDay() };
}

/** El instante (UTC) de una fecha local a una hora local. */
export function atLocal(date: string, hour: number, minute = 0) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + hour * 3600_000 + minute * 60_000 + OFFSET_MS);
}

export function addDays(date: string, n: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
}

/** Cuándo se revela una ronda abierta ahora: a la hora del reveal, con al menos 90 minutos de juego. */
export function revealAtFor(now: Date, revealHour: number) {
  const today = atLocal(local(now).date, revealHour);
  return today.getTime() - now.getTime() >= 90 * 60_000 ? today : atLocal(addDays(local(now).date, 1), revealHour);
}

// ---------- Leer lo que escribe la gente ----------
export function canonical(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9#]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export type Command = 'salir' | 'borrame' | 'pausa' | 'vuelvo' | 'ayuda' | 'tabla' | 'nuevo' | 'otra' | 'ideas' | 'saltear' | 'si' | 'no';

export function command(text: string): Command | null {
  const t = canonical(text);
  if (['SALIR', 'BAJA', 'STOP', 'NO ME ESCRIBAN'].includes(t)) return 'salir';
  if (['BORRAME', 'BORRAR', 'BORRAR TODO', 'BORRAME TODO'].includes(t)) return 'borrame';
  if (['PAUSA', 'PAUSAR', 'HOY NO'].includes(t)) return 'pausa';
  if (['VUELVO', 'VOLVER', 'VOLVI'].includes(t)) return 'vuelvo';
  if (['AYUDA', 'REGLAS', 'COMO SE JUEGA', 'MENU', 'HELP'].includes(t)) return 'ayuda';
  if (['TABLA', 'RANKING', 'PUNTOS'].includes(t)) return 'tabla';
  if (['NUEVO', 'NUEVO GRUPO', 'OTRO GRUPO', 'QUIERO JUGAR CON MI GRUPO', 'QUIERO JUGAR', 'JUGAR'].includes(t)) return 'nuevo';
  if (['OTRA', 'OTRA TEMPORADA', 'REVANCHA'].includes(t)) return 'otra';
  if (['IDEAS', 'IDEA', 'OTRAS', 'MAS'].includes(t)) return 'ideas';
  if (['SALTEAR', 'SALTAR', 'PASO', 'PASAR', 'PAS'].includes(t)) return 'saltear';
  if (['SI', 'S', 'SII', 'SIP', 'OBVIO', 'ME LEYO', 'SI ME LEYO'].includes(t)) return 'si';
  if (['NO', 'N', 'NOP', 'NI AHI', 'NADA QUE VER'].includes(t)) return 'no';
  return null;
}

/** A o B, por letra, número o por el texto de la opción. */
export function parseChoice(text: string, a: string, b: string): Choice | null {
  const t = canonical(text);
  if (['A', '1', 'OPCION A', 'LA A', 'A)'].includes(t)) return 'a';
  if (['B', '2', 'OPCION B', 'LA B', 'B)'].includes(t)) return 'b';
  const ca = canonical(a), cb = canonical(b);
  if (t && t === ca) return 'a';
  if (t && t === cb) return 'b';
  if (t.length >= 3 && ca.startsWith(t) && !cb.startsWith(t)) return 'a';
  if (t.length >= 3 && cb.startsWith(t) && !ca.startsWith(t)) return 'b';
  return null;
}

export function parseIndex(text: string, n: number): number | null {
  const m = canonical(text).match(/^(\d{1,2})$/);
  if (!m) return null;
  const i = Number(m[1]);
  return i >= 1 && i <= n ? i - 1 : null;
}

export function parseAge(text: string): number | null {
  const m = canonical(text).match(/^(\d{1,2})( ANOS)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 10 && n <= 99 ? n : null;
}

export function cleanName(text: string, max = 30) {
  return text.replace(/[\r\n\t]+/g, ' ').replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

/** "Lu, Juan y Mati" → ["Lu", "Juan", "Mati"]. Sin repetidos, hasta 11. */
export function parseRoster(text: string) {
  const parts = text.split(/[,;\n]|\s+y\s+|\s+e\s+|\s*\/\s*/i).map((p) => cleanName(p.replace(/^\d+[.)-]\s*/, ''))).filter((p) => p.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = canonical(p);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out.slice(0, 11);
}

// Códigos de grupo: 5 caracteres sin letras que se confunden (I, O) y con al menos un número.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newGroupCode(rand: () => number = Math.random) {
  for (;;) {
    const c = Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]).join('');
    if (/\d/.test(c)) return c;
  }
}

export function findCode(text: string): string | null {
  const t = text.toUpperCase();
  const m = t.match(/#\s?([A-HJ-NP-Z2-9]{5})\b/) ?? t.match(/\b(?=[A-HJ-NP-Z2-9]*\d)([A-HJ-NP-Z2-9]{5})\b/);
  return m ? m[1] : null;
}

// ---------- Quién pregunta, a quién le habla cada uno ----------
export function byPosition(members: Member[]) {
  return [...members].sort((x, y) => x.position - y.position);
}

/** El autor del día rota en el orden en que entraron. */
export function authorFor(active: Member[], day: number, season = 1) {
  const list = byPosition(active);
  if (list.length === 0) return null;
  return list[(day - 1 + (season - 1)) % list.length];
}

/** A quién le manda el audio cada uno: una rotación sin que nadie se toque a sí mismo. */
export function assignTargets(active: Member[], day: number) {
  const list = byPosition(active);
  const n = list.length;
  const out: Record<string, string> = {};
  if (n < 2) return out;
  const shift = 1 + ((day - 1) % (n - 1));
  list.forEach((m, i) => { out[m.id] = list[(i + shift) % n].id; });
  return out;
}

// ---------- Puntaje ----------
export const POINTS = { bet: 10, victimBet: 20, voiceRead: 10, authorSplitMax: 20, victimSafe: 15 };

export function splitBonus(a: number, b: number) {
  const n = a + b;
  if (n < 3) return 0;
  return Math.round(POINTS.authorSplitMax * (1 - Math.abs(a / n - 0.5) * 2));
}

export function scoreRound(input: {
  roundId: string;
  answers: Answer[];
  bets: Bet[];
  authorId: string | null;
  victimId: string | null;
}) {
  const choice = new Map(input.answers.map((a) => [a.member_id, a.choice]));
  const graded = input.bets.map((b) => {
    const truth = choice.get(b.target_member_id);
    return { ...b, correct: truth ? truth === b.guess : null };
  });
  const totals = new Map<string, number>();
  const add = (row: PointRow) => totals.set(row.member_id, (totals.get(row.member_id) ?? 0) + row.points);
  const rows: PointRow[] = [];
  const perBettor = new Map<string, number>();
  for (const b of graded) if (b.correct) perBettor.set(b.bettor_member_id, (perBettor.get(b.bettor_member_id) ?? 0) + 1);
  const value = input.victimId ? POINTS.victimBet : POINTS.bet;
  for (const [member, hits] of perBettor) rows.push({ round_id: input.roundId, member_id: member, reason: 'bet', points: hits * value });

  const a = input.answers.filter((x) => x.choice === 'a').length;
  const b = input.answers.length - a;
  if (input.authorId) {
    const bonus = splitBonus(a, b);
    if (bonus > 0) rows.push({ round_id: input.roundId, member_id: input.authorId, reason: 'author_split', points: bonus });
  }
  if (input.victimId && choice.has(input.victimId)) {
    const onVictim = graded.filter((x) => x.target_member_id === input.victimId);
    if (onVictim.length >= 2 && onVictim.every((x) => x.correct === false)) {
      rows.push({ round_id: input.roundId, member_id: input.victimId, reason: 'victim_safe', points: POINTS.victimSafe });
    }
  }
  rows.forEach(add);
  return { graded, rows, totals, split: { a, b } };
}

/** Las dos o tres frases del reveal. Crueles, cortas, con nombres. */
export function headlineLines(input: {
  names: Map<string, string>;
  graded: { bettor_member_id: string; target_member_id: string; correct: boolean | null }[];
  split: { a: number; b: number };
  optionA: string;
  optionB: string;
}) {
  const lines: string[] = [];
  const name = (id: string) => input.names.get(id) ?? '?';
  const made = new Map<string, { hit: number; total: number }>();
  const got = new Map<string, { hit: number; total: number }>();
  for (const g of input.graded) {
    if (g.correct === null) continue;
    const m = made.get(g.bettor_member_id) ?? { hit: 0, total: 0 };
    m.total++; if (g.correct) m.hit++; made.set(g.bettor_member_id, m);
    const r = got.get(g.target_member_id) ?? { hit: 0, total: 0 };
    r.total++; if (g.correct) r.hit++; got.set(g.target_member_id, r);
  }
  const best = [...made.entries()].filter(([, v]) => v.total >= 2).sort((x, y) => y[1].hit / y[1].total - x[1].hit / x[1].total || y[1].total - x[1].total)[0];
  if (best) lines.push(best[1].hit === best[1].total ? `${name(best[0])} leyó a todos.` : `${name(best[0])} leyó a ${best[1].hit} de ${best[1].total}.`);
  const unread = [...got.entries()].filter(([, v]) => v.total >= 2 && v.hit === 0).map(([k]) => k)[0];
  if (unread) lines.push(`Nadie leyó a ${name(unread)}.`);
  const lost = [...made.entries()].filter(([k, v]) => v.total >= 2 && v.hit === 0 && k !== best?.[0]).map(([k]) => k)[0];
  if (lost) lines.push(`${name(lost)} no tiene idea de con quién sale los viernes.`);
  const n = input.split.a + input.split.b;
  if (n >= 2 && lines.length < 3) {
    const pa = Math.round((100 * input.split.a) / n);
    lines.push(pa === 50 ? `Mitad y mitad. El grupo está partido.` : pa > 50 ? `${pa}% dijo «${input.optionA}».` : `${100 - pa}% dijo «${input.optionB}».`);
  }
  return lines.slice(0, 3);
}

/** La primera ronda del grupo: la arma el fundador antes de que entre nadie. */
export const isOnboarding = (r: { season: number; day: number }) => r.season === 1 && r.day === 1;

// ---------- Etiquetas de fin de temporada (voz ClickHole) ----------
export type SeasonStat = { member_id: string; reads_hit: number; reads_total: number; read_hit: number; read_total: number; voices: number; answered: number };

export const LABELS = {
  bestReader: 'Te conoce más que tu vieja',
  worstReader: 'El amigo que todos tienen por error',
  unreadable: 'Nadie sabe qué carajo le pasa',
  openBook: 'Un libro abierto. Abierto en la página de los chistes',
  talker: 'Manda audios de 10 segundos que duran 40',
  ghost: 'Está en el grupo como está la planta en el living',
  rest: 'Está. Es lo más lindo que podemos decir',
};

export function seasonLabels(stats: SeasonStat[]) {
  const out = new Map<string, string>();
  const free = (s: SeasonStat) => !out.has(s.member_id);
  const rate = (h: number, t: number) => (t === 0 ? null : h / t);
  const pick = (label: string, list: SeasonStat[], score: (s: SeasonStat) => number | null, dir: 1 | -1) => {
    const c = list.filter(free).map((s) => ({ s, v: score(s) })).filter((x) => x.v !== null) as { s: SeasonStat; v: number }[];
    if (c.length === 0) return;
    c.sort((x, y) => dir * (y.v - x.v));
    out.set(c[0].s.member_id, label);
  };
  if (stats.length >= 2) {
    pick(LABELS.bestReader, stats, (s) => rate(s.reads_hit, s.reads_total), 1);
    pick(LABELS.worstReader, stats, (s) => rate(s.reads_hit, s.reads_total), -1);
    pick(LABELS.unreadable, stats, (s) => rate(s.read_hit, s.read_total), -1);
    pick(LABELS.openBook, stats, (s) => rate(s.read_hit, s.read_total), 1);
    pick(LABELS.talker, stats, (s) => (s.voices > 0 ? s.voices : null), 1);
    pick(LABELS.ghost, stats, (s) => s.answered, -1);
  }
  for (const s of stats) if (!out.has(s.member_id)) out.set(s.member_id, LABELS.rest);
  return out;
}

/** Quién tiene que apostar por quién en una ronda. */
export function betTargets(input: {
  onboarding: boolean;
  me: Member;
  founderMemberId: string | null;
  members: Member[];
  victimId: string | null;
}) {
  const { me } = input;
  if (input.onboarding) {
    // El primer día apuesta solo el fundador, por todos los de su lista.
    if (me.id !== input.founderMemberId) return [];
    return byPosition(input.members.filter((m) => m.id !== me.id && (m.status === 'listed' || m.status === 'active'))).map((m) => m.id);
  }
  if (input.victimId) return input.victimId === me.id ? [] : [input.victimId];
  return byPosition(input.members.filter((m) => m.id !== me.id && m.status === 'active')).map((m) => m.id);
}
