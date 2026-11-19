// La placa de entrada del Drop se muestra antes del onboarding; si ya la vio en esta pestaña, el Drop no la repite.
const key = (slug: string) => `brutal_intro_seen:${slug}`;
export function markIntroSeen(slug: string) {
  try { sessionStorage.setItem(key(slug), String(Date.now())); } catch { /* sin storage: la vuelve a ver, no pasa nada */ }
}
export function introSeen(slug: string) {
  try { const t = Number(sessionStorage.getItem(key(slug))); return Number.isFinite(t) && Date.now() - t < 6 * 3600_000; } catch { return false; }
}
