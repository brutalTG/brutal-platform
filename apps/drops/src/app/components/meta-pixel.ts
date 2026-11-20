// ============================================================
// PIXEL DE META — para optimizar los anuncios por gente que termina el Drop
// ============================================================
// El código base (PageView) está en index.html y solo carga en drops.brutal.lat (no en test).
// Eventos, en orden del embudo:
//   ViewContent           vio la placa del Drop
//   CompleteRegistration  terminó el onboarding
//   Lead                  terminó el Drop (llegó a la pantalla final)  ← el objetivo de las campañas
//   Contact               tocó "Reclamá tus tickets" (abre WhatsApp)
// Cada evento sale una sola vez por persona y Drop en este teléfono, así recargar no infla los números.
// ============================================================

type Fbq = (...args: unknown[]) => void;

export function metaEvent(event: "ViewContent" | "CompleteRegistration" | "Lead" | "Contact", key: string, params: Record<string, unknown> = {}) {
  try {
    const fbq = (window as unknown as { fbq?: Fbq }).fbq;
    if (!fbq) return;
    const once = `brutal_px_${event}_${key}`;
    if (localStorage.getItem(once)) return;
    localStorage.setItem(once, "1");
    fbq("track", event, params);
  } catch {}
}
