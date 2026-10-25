// Reglas de Drops sin base de datos (se prueban solas). Mismas reglas que el sandbox (server/node-domain.ts).

export const POLICY = {
  currency: 'USD',
  withdrawalMinimum: 10,
  minorAgeMinimum: 15,
  minorAgeMaximumExclusive: 18,
  minorCashEnabled: false, // nunca: un menor no cobra efectivo
  minorTicketsPerCashReward: 1,
} as const;

export type Reward = { cash: number; tickets: number; minor: number | null };

/** Lo que cobra un nodo por una carta. Menor: nunca plata; tickets explícitos o 1 por cada premio en plata. */
export function resolveReward(r: Reward, isMinor: boolean): { cash: number; tickets: number } {
  const cash = Math.max(0, Number(r.cash) || 0), tickets = Math.max(0, Math.floor(Number(r.tickets) || 0));
  if (!isMinor) return { cash, tickets };
  if (r.minor !== null && r.minor !== undefined) return { cash: 0, tickets: Math.max(0, Math.floor(r.minor)) };
  return { cash: 0, tickets: tickets > 0 ? tickets : cash > 0 ? POLICY.minorTicketsPerCashReward : 0 };
}

/** Premio que ve el jugador en la carta: plata si hay, si no tickets. */
export function displayReward(r: { cash: number; tickets: number }) {
  if (r.cash > 0) return { type: 'coins' as const, value: r.cash };
  if (r.tickets > 0) return { type: 'tickets' as const, value: r.tickets };
  return undefined;
}

/** El multiplicador más alto que alcanzó: los checkpoints con índice menor a las cartas contestadas. */
export function multiplierFor(checkpoints: Record<string, { multiplier?: number }> | undefined, answered: number) {
  let m = 1;
  for (const [k, v] of Object.entries(checkpoints ?? {})) {
    const idx = Number(k), mult = Number(v?.multiplier);
    if (Number.isFinite(idx) && idx < answered && Number.isFinite(mult) && mult > m) m = mult;
  }
  return m;
}

export type AnswerRow = { position: number; reward_currency: 'cash_usd' | 'tickets' | null; reward_value: number; reward_granted: boolean; trap_correct: boolean | null; penalty: number };

/** Lo que se acredita al reclamar. Una trampa fallada resta tickets acumulados (nunca plata). El multiplicador solo multiplica tickets. */
export function computeClaim(answers: AnswerRow[], multiplier: number) {
  let usd = 0, tickets = 0;
  for (const a of [...answers].sort((x, y) => x.position - y.position)) {
    if (a.trap_correct === false) { tickets = Math.max(0, tickets - (Number(a.penalty) || 0)); continue; }
    if (!a.reward_granted) continue;
    if (a.reward_currency === 'cash_usd') usd = Math.round((usd + Number(a.reward_value)) * 100) / 100;
    else if (a.reward_currency === 'tickets') tickets += Number(a.reward_value);
  }
  return { usd, tickets: Math.floor(tickets * Math.max(1, Number(multiplier) || 1)) };
}

export type AnswerBody = {
  choice_index?: number | null; slider_value?: number | null; ranking_result?: unknown[] | null;
  rafaga_choices?: unknown[] | null; text_response?: string | null; choice?: string | null;
};

/** Cómo queda la respuesta en signal.observations. */
export function observationOf(format: string, content: Record<string, any>, b: AnswerBody) {
  const options: unknown[] = Array.isArray(content.options) ? content.options : [];
  if (typeof b.choice_index === 'number') {
    const option = options[b.choice_index] ?? null;
    return { kind: 'choice', value: { index: b.choice_index, option }, text: option == null ? String(b.choice_index) : String(option), number: b.choice_index };
  }
  if (typeof b.slider_value === 'number') return { kind: 'scale', value: { value: b.slider_value }, text: null, number: b.slider_value };
  if (Array.isArray(b.ranking_result)) return { kind: 'ranking', value: { order: b.ranking_result }, text: b.ranking_result.join(' > '), number: null };
  if (Array.isArray(b.rafaga_choices)) return { kind: 'choice', value: { choices: b.rafaga_choices }, text: null, number: null };
  if (b.choice === 'A' || b.choice === 'B') return { kind: 'choice', value: { side: b.choice }, text: b.choice, number: null };
  if (format === 'confesionario') return { kind: 'text', value: { submitted: true }, text: null, number: null };
  return { kind: 'behavior', value: { timeout: format !== 'dead_drop', viewed: format === 'dead_drop' }, text: null, number: null };
}

/** Qué tan bien coinciden las latencias que manda el teléfono con el tiempo real entre respuestas (0 = perfecto). */
export function consistencyOf(rows: { latency_ms: number | null; created_at: string }[]) {
  if (rows.length < 3) return null;
  const diffs: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const delta = Date.parse(rows[i].created_at) - Date.parse(rows[i - 1].created_at);
    if (delta < 100 || rows[i].latency_ms == null) continue;
    diffs.push(Math.abs(Number(rows[i].latency_ms) - delta));
  }
  if (diffs.length < 2) return null;
  return Math.min(1, diffs.reduce((a, b) => a + b, 0) / diffs.length / 10000);
}

export const normalizeWallet = (raw: unknown) => {
  const v = String(raw ?? '').trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9._-]{3,80}$/.test(v) ? v : null;
};

/** Edad (años cumplidos) a fecha de nacimiento aproximada: hoy menos esa cantidad de años. */
export function birthDateFromAge(age: number, now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear() - age, now.getUTCMonth(), now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/** "Provincia > Ciudad" o "Provincia — Ciudad". */
export function parseLocation(raw: unknown) {
  const s = String(raw ?? '').trim();
  if (!s) return { province: null, city: null };
  const [p, c] = s.split(/\s*(?:>|—|-)\s*/);
  return { province: p?.slice(0, 80) || null, city: c?.slice(0, 80) || null };
}
