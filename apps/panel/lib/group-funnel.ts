// Embudo del link de grupo: abrió → puso apodo → empezó → terminó → lo pasó.
// Cuenta personas (un teléfono = un id anónimo), no toques. Deja afuera las pruebas: todo lo de jugadores archivados.

export type JoinEvent = { event: 'open' | 'joined' | 'shared'; client_id: string | null; node_id: string | null; source: string | null; created_at: string };
export type Player = { node_id: string; nickname: string | null; archived: boolean };
export type Session = { node_id: string | null; status: string; position: number | null; total_ms: number | null; archetype: { id?: string; title?: string } | null; started_at: string };

export type SourceRow = { source: string; opened: number; joined: number; started: number; completed: number };
export type PlayerRow = { nickname: string; source: string; status: 'sin empezar' | 'jugando o se fue' | 'terminó'; reached: number | null; minutes: number | null; profile: string | null; joined_at: string };

export const NO_SOURCE = 'sin etiqueta';
const label = (s: string | null) => s ?? NO_SOURCE;

export function groupFunnel(events: JoinEvent[], players: Player[], sessions: Session[]) {
  const archived = new Set(players.filter((p) => p.archived).map((p) => p.node_id));
  const nick = new Map(players.map((p) => [p.node_id, p.nickname]));
  // Un teléfono que alguna vez entró como jugador de prueba es de prueba en todo.
  const testClients = new Set(events.filter((e) => e.event === 'joined' && e.node_id && archived.has(e.node_id) && e.client_id).map((e) => e.client_id!));
  const real = events.filter((e) => !(e.client_id && testClients.has(e.client_id)) && !(e.node_id && archived.has(e.node_id)));

  // Personas que abrieron: un id por teléfono; si no hay id, cada apertura cuenta sola.
  const openedBy = new Map<string, string>(); // persona → origen de su primera apertura
  real.filter((e) => e.event === 'open').sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((e, i) => {
    const who = e.client_id ?? `anon-${i}`;
    if (!openedBy.has(who)) openedBy.set(who, label(e.source));
  });

  const joins = real.filter((e) => e.event === 'joined' && e.node_id);
  const sourceOfNode = new Map(joins.map((e) => [e.node_id!, label(e.source)]));
  const sessionOf = new Map<string, Session>();
  for (const s of sessions) if (s.node_id && sourceOfNode.has(s.node_id)) sessionOf.set(s.node_id, s);

  const started = [...sessionOf.values()];
  const completed = started.filter((s) => s.status === 'completed');
  const shared = new Set(real.filter((e) => e.event === 'shared').map((e, i) => e.client_id ?? `anon-${i}`)).size;

  const bySource = new Map<string, SourceRow>();
  const row = (s: string) => { let r = bySource.get(s); if (!r) { r = { source: s, opened: 0, joined: 0, started: 0, completed: 0 }; bySource.set(s, r); } return r; };
  for (const s of openedBy.values()) row(s).opened++;
  for (const e of joins) {
    const r = row(label(e.source)); r.joined++;
    const s = sessionOf.get(e.node_id!);
    if (s) { r.started++; if (s.status === 'completed') r.completed++; }
  }
  const sources = [...bySource.values()].sort((a, b) => b.opened - a.opened || b.joined - a.joined);
  const viaShare = sources.filter((r) => r.source.startsWith('r-'));

  const profiles = new Map<string, number>();
  for (const s of completed) { const t = (s.archetype?.title ?? 'Sin perfil').replace(/\n/g, ' '); profiles.set(t, (profiles.get(t) ?? 0) + 1); }

  const times = completed.map((s) => Number(s.total_ms)).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : null;

  const playerRows: PlayerRow[] = joins
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((e) => {
      const s = sessionOf.get(e.node_id!);
      return {
        nickname: nick.get(e.node_id!) ?? '—',
        source: label(e.source),
        status: !s ? 'sin empezar' : s.status === 'completed' ? 'terminó' : 'jugando o se fue',
        reached: s ? (s.status === 'completed' ? null : Number(s.position ?? 0) + 1) : null,
        minutes: s?.status === 'completed' && s.total_ms ? Math.round(Number(s.total_ms) / 6000) / 10 : null,
        profile: s?.status === 'completed' ? (s.archetype?.title ?? null)?.replace(/\n/g, ' ') ?? null : null,
        joined_at: e.created_at,
      };
    });

  return {
    opened: openedBy.size, joined: joins.length, started: started.length, completed: completed.length, shared,
    viaShare: { opened: viaShare.reduce((n, r) => n + r.opened, 0), joined: viaShare.reduce((n, r) => n + r.joined, 0) },
    medianMinutes: median ? Math.round(median / 6000) / 10 : null,
    sources, profiles: [...profiles.entries()].sort((a, b) => b[1] - a[1]), players: playerRows,
  };
}
