// ============================================================
// PASÁSELO A ALGUIEN — al final del Drop, el link de grupo con el código de este jugador.
// Así sabemos cuántos llegaron por reenvío y quién los trajo (sin datos personales: r-<código>).
// ============================================================

import { API_BASE } from "./api-base";
import { hapticMedium } from "./haptics";

type Share = { code: string; ref: string };

export function shareInfo(): Share | null {
  try {
    const v = JSON.parse(localStorage.getItem("brutal_share") || "null");
    return v && typeof v.code === "string" && typeof v.ref === "string" ? v : null;
  } catch {
    return null;
  }
}

/** Link de grupo con el código de reenvío de este jugador, o null si no entró por un link de grupo. */
export function passAlongLink(): string | null {
  const s = shareInfo();
  return s ? `${window.location.origin}/j/${encodeURIComponent(s.code)}?de=${encodeURIComponent(s.ref)}` : null;
}

export function PassAlongButton() {
  const s = shareInfo();
  const link = passAlongLink();
  if (!s || !link) return null;

  async function go() {
    hapticMedium();
    let client: string | null = null;
    try { client = localStorage.getItem("brutal_client"); } catch {}
    fetch(`${API_BASE}/join/shared`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: s!.code, client, source: s!.ref }), keepalive: true }).catch(() => {});
    const text = "Jugá esto. Son 5 minutos y no tiene salida limpia.";
    if (navigator.share) {
      try { await navigator.share({ text, url: link! }); return; } catch { /* canceló o no se pudo: probamos WhatsApp */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, "_blank");
  }

  return (
    <button
      onClick={go}
      className="mt-3 h-[52px] w-full max-w-[290px] rounded-full border-2 font-['Roboto'] text-[16px] font-bold active:scale-[0.98]"
      style={{ borderColor: "var(--dynamic-bg, #000)", color: "var(--dynamic-bg, #000)" }}
    >
      Pasáselo a alguien
    </button>
  );
}
