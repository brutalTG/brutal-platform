// ============================================================
// ENTRADA DESDE ANUNCIOS — /jugar
// Instagram → acá → onboarding → Drop. Sin landing y sin WhatsApp antes de jugar.
// ?utm_campaign= / ?de= dice de qué anuncio vino; ?r= es el código del amigo que lo invitó.
// En este teléfono se recuerda la partida empezada, así volver a tocar el anuncio no crea otro jugador.
// ============================================================

import { useEffect, useState } from "react";
import { API_BASE } from "./api-base";

const KEY = "brutal_web";
const KEEP_MS = 70 * 3600_000; // el link del onboarding dura 72 h

function clientId() {
  try {
    let id = localStorage.getItem("brutal_client");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("brutal_client", id); }
    return id;
  } catch {
    return null;
  }
}

function saved(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.url === "string" && Date.now() - Number(v.at) < KEEP_MS ? v.url : null;
  } catch {
    return null;
  }
}

export default function WebEntry() {
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    const q = new URLSearchParams(window.location.search);
    const again = saved();
    if (again && !q.get("nuevo")) { window.location.replace(again); return; }
    try {
      const res = await fetch(`${API_BASE}/web/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: q.get("r"),
          source: q.get("utm_campaign") || q.get("de") || q.get("utm_source"),
          client: clientId(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.message || "No pudimos abrir el Drop. Probá de nuevo.");
      try { localStorage.setItem(KEY, JSON.stringify({ url: data.url, at: Date.now() })); } catch {}
      window.location.replace(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos abrir el Drop. Probá de nuevo.");
    }
  }

  useEffect(() => { start(); }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-[380px] text-center">
        <p className="mb-6 font-['Silkscreen'] text-[28px] tracking-widest">BRUTAL</p>
        {error ? (
          <>
            <p className="mb-6 font-['Fira_Code'] text-[13px] leading-relaxed text-white/70">{error}</p>
            <button onClick={start} className="h-[56px] w-full rounded-full bg-[#E8FF00] font-['Roboto'] text-[17px] font-extrabold text-black active:scale-[0.98]">
              PROBAR DE NUEVO
            </button>
          </>
        ) : (
          <p className="font-['Fira_Code'] text-[12px] uppercase tracking-widest text-white/50 animate-pulse">Abriendo el Drop…</p>
        )}
      </div>
    </div>
  );
}
