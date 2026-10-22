// Un solo lugar donde cada estado del sistema tiene su nombre en castellano y su tono.
// Así el mismo estado se ve igual en todas las pantallas.

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
type Entry = { label: string; tone: Tone };

const maps: Record<string, Record<string, Entry>> = {
  node: {
    active: { label: 'Activo', tone: 'success' },
    pending: { label: 'Pendiente', tone: 'warning' },
    waitlisted: { label: 'En espera', tone: 'info' },
    blocked: { label: 'Bloqueado', tone: 'danger' },
    archived: { label: 'Archivado', tone: 'neutral' },
  },
  study: {
    draft: { label: 'Borrador', tone: 'neutral' },
    design: { label: 'Diseño', tone: 'info' },
    field: { label: 'En campo', tone: 'success' },
    analysis: { label: 'Análisis', tone: 'info' },
    published: { label: 'Publicado', tone: 'accent' },
    archived: { label: 'Archivado', tone: 'neutral' },
  },
  drop: {
    draft: { label: 'Borrador', tone: 'neutral' },
    scheduled: { label: 'Programado', tone: 'info' },
    live: { label: 'En vivo', tone: 'success' },
    closed: { label: 'Cerrado', tone: 'neutral' },
    archived: { label: 'Archivado', tone: 'neutral' },
  },
  experiment: {
    draft: { label: 'Borrador', tone: 'neutral' },
    testing: { label: 'En prueba', tone: 'warning' },
    live: { label: 'En vivo', tone: 'success' },
    retired: { label: 'Retirado', tone: 'neutral' },
  },
  session: {
    started: { label: 'En curso', tone: 'info' },
    completed: { label: 'Completa', tone: 'success' },
    abandoned: { label: 'Abandonada', tone: 'warning' },
    interrupted: { label: 'Cortada', tone: 'warning' },
    failed: { label: 'Falló', tone: 'danger' },
  },
  template: {
    draft: { label: 'Borrador', tone: 'neutral' },
    submitted: { label: 'En revisión', tone: 'info' },
    approved: { label: 'Aprobada', tone: 'success' },
    rejected: { label: 'Rechazada', tone: 'danger' },
    paused: { label: 'Pausada', tone: 'warning' },
  },
  withdrawal: {
    pending: { label: 'Pendiente', tone: 'warning' },
    approved: { label: 'Aprobado', tone: 'info' },
    rejected: { label: 'Rechazado', tone: 'danger' },
    paid: { label: 'Pagado', tone: 'success' },
  },
  season: {
    draft: { label: 'Borrador', tone: 'neutral' },
    active: { label: 'Activa', tone: 'success' },
    closed: { label: 'Cerrada', tone: 'neutral' },
  },
  app: {
    active: { label: 'Activa', tone: 'success' },
    paused: { label: 'Pausada', tone: 'warning' },
    retired: { label: 'Retirada', tone: 'neutral' },
  },
  actor: {
    claude: { label: 'Claude', tone: 'accent' },
    admin: { label: 'Equipo', tone: 'info' },
    system: { label: 'Sistema', tone: 'neutral' },
  },
};

export function statusOf(kind: keyof typeof maps, value: string | null | undefined): Entry {
  if (!value) return { label: '—', tone: 'neutral' };
  return maps[kind]?.[value] ?? { label: value, tone: 'neutral' };
}

export const nodeStatuses = Object.entries(maps.node).map(([value, e]) => ({ value, label: e.label }));
