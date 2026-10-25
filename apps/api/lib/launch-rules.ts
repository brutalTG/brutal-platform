// A quién le llega un lanzamiento. Sin base de datos: se prueba solo.

export type Audience =
  | { type: 'all' }
  | { type: 'filter'; minAge?: number | null; maxAge?: number | null; genders?: string[]; provinces?: string[]; minors?: 'include' | 'exclude' | 'only' }
  | { type: 'phones'; phones: string[] };

export type Candidate = { id: string; phone: string; status: string; age: number | null; is_minor: boolean; gender: string | null; province: string | null; opted_out: boolean; already_played: boolean };

const norm = (s: string | null) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Quiénes entran: nunca bloqueados, archivados, dados de baja ni los que ya jugaron este Drop. */
export function selectAudience(all: Candidate[], a: Audience, max = 2000) {
  const reasons = { opted_out: 0, already_played: 0, not_allowed: 0 };
  const phones = a.type === 'phones' ? new Set(a.phones.map((p) => p.replace(/[^\d+]/g, ''))) : null;
  const out: Candidate[] = [];
  for (const c of all) {
    if (phones && !phones.has(c.phone)) continue;
    if (a.type === 'filter') {
      if (a.minAge != null && (c.age == null || c.age < a.minAge)) continue;
      if (a.maxAge != null && (c.age == null || c.age > a.maxAge)) continue;
      if (a.genders?.length && !a.genders.map(norm).includes(norm(c.gender))) continue;
      if (a.provinces?.length && !a.provinces.map(norm).includes(norm(c.province))) continue;
      if (a.minors === 'exclude' && c.is_minor) continue;
      if (a.minors === 'only' && !c.is_minor) continue;
    }
    if (['blocked', 'archived', 'waitlisted'].includes(c.status)) { reasons.not_allowed++; continue; }
    if (c.opted_out) { reasons.opted_out++; continue; }
    if (c.already_played) { reasons.already_played++; continue; }
    out.push(c);
  }
  return { selected: out.slice(0, max), skipped: reasons, truncated: out.length > max };
}
