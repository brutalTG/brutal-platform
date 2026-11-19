// ============================================================
// ENTRADA DESDE ANUNCIOS — /jugar
// Instagram → acá → placa → onboarding → Drop. Sin landing y sin WhatsApp antes de jugar.
// ?utm_campaign= / ?de= dice de qué anuncio vino; ?r= es el código del amigo que lo invitó.
// Una sola vuelta al servidor: crea el jugador y devuelve el acceso y la placa, que se muestra acá mismo
// (sin pasar por /a/<código> ni recargar la página). Mientras mira la placa se carga su perfil.
// En este teléfono se recuerda la partida empezada, así volver a tocar el anuncio no crea otro jugador.
// ============================================================

import { lazy, Suspense, useEffect, useState } from "react";
import { API_BASE } from "./api-base";
import type { PrizeConfig, SplashConfig } from "./drop-types";

// Se baja en paralelo con el pedido al servidor.
const loadOnboarding = () => import("./onboarding/OnboardingApp");
const OnboardingApp = lazy(loadOnboarding);

const KEY = "brutal_web";
const KEEP_MS = 70 * 3600_000; // el acceso dura 72 h

type Intro = { slug: string; splash: SplashConfig; prize: PrizeConfig | null };
type Saved = { url: string; token?: string; intro?: Intro | null; at: number };

function clientId() {
  try {
    let id = localStorage.getItem("brutal_client");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("brutal_client", id); }
    return id;
  } catch {
    return null;
  }
}

function saved(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.url === "string" && Date.now() - Number(v.at) < KEEP_MS ? v : null;
  } catch {
    return null;
  }
}

/** Deja el acceso donde lo busca el onboarding (como si viniera de /entrar?access=…), sin recargar. */
function putToken(token: string) {
  window.history.replaceState({}, "", `/entrar?access=${encodeURIComponent(token)}`);
}

export default function WebEntry() {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ intro: Intro | null } | null>(null);

  async function start() {
    setError(null);
    loadOnboarding().catch(() => {});
    const q = new URLSearchParams(window.location.search);
    const again = q.get("nuevo") ? null : saved();
    if (again?.token) { putToken(again.token); setReady({ intro: again.intro ?? null }); return; }
    if (again) { window.location.replace(again.url); return; }
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
      try { localStorage.setItem(KEY, JSON.stringify({ url: data.url, token: data.token, intro: data.intro ?? null, at: Date.now() })); } catch {}
      if (!data.token) { window.location.replace(data.url); return; } // API vieja
      if (data.intro?.splash?.mode === "image" && data.intro.splash.imageUrl) new Image().src = data.intro.splash.imageUrl;
      putToken(data.token);
      setReady({ intro: data.intro ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos abrir el Drop. Probá de nuevo.");
    }
  }

  useEffect(() => { start(); }, []);

  if (ready) {
    return (
      <Suspense fallback={<Loading />}>
        <OnboardingApp initialIntro={ready.intro} />
      </Suspense>
    );
  }

  return error ? (
    <div className="fixed inset-0 flex items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-[380px] text-center">
        <p className="mb-6 font-['Silkscreen'] text-[28px] tracking-widest">BRUTAL</p>
        <p className="mb-6 font-['Fira_Code'] text-[13px] leading-relaxed text-white/70">{error}</p>
        <button onClick={start} className="h-[56px] w-full rounded-full bg-[#E8FF00] font-['Roboto'] text-[17px] font-extrabold text-black active:scale-[0.98]">
          PROBAR DE NUEVO
        </button>
      </div>
    </div>
  ) : <Loading />;
}

function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-[380px] text-center">
        <p className="mb-6 font-['Silkscreen'] text-[28px] tracking-widest">BRUTAL</p>
        <p className="font-['Fira_Code'] text-[12px] uppercase tracking-widest text-white/50 animate-pulse">Abriendo el Drop…</p>
      </div>
    </div>
  );
}
