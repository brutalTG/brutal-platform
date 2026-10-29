// ============================================================
// LINK DE GRUPO — /j/<código>
// Un solo link para todo un grupo. Cada uno pone su apodo y entra con su propia partida.
// En este teléfono se recuerda quién entró, así volver a tocar el link no crea otro jugador.
// ============================================================

import { useEffect, useState } from "react";
import { API_BASE } from "./api-base";

type Saved = { url: string; nickname: string };

const keyOf = (code: string) => `brutal_join_${code}`;

/** Id anónimo de este navegador, para contar aperturas sin contar dos veces a la misma persona. */
function clientId() {
  try {
    let id = localStorage.getItem("brutal_client");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("brutal_client", id); }
    return id;
  } catch {
    return null;
  }
}

function readSaved(code: string): Saved | null {
  try {
    const raw = localStorage.getItem(keyOf(code));
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.url === "string" && typeof v.nickname === "string" ? v : null;
  } catch {
    return null;
  }
}

function save(code: string, v: Saved) {
  try { localStorage.setItem(keyOf(code), JSON.stringify(v)); } catch {}
}

function forget(code: string) {
  try { localStorage.removeItem(keyOf(code)); } catch {}
}

/** Para "pasáselo a alguien" al final: el código del link y el de reenvío de este jugador. */
export function saveShareInfo(code: string, ref: string | undefined) {
  if (!ref) return;
  try { localStorage.setItem("brutal_share", JSON.stringify({ code, ref })); } catch {}
}

export default function GroupJoin() {
  const code = (window.location.pathname.split("/").filter(Boolean)[1] ?? "").toLowerCase();
  // De dónde llegó: ?de=grupo1, o r-xxxx si se lo pasó otro jugador.
  const source = new URLSearchParams(window.location.search).get("de") || null;
  const [saved, setSaved] = useState<Saved | null>(null);
  const [nickname, setNickname] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSaved(readSaved(code));
    // Embudo: abrió el link. Normalmente ya lo anotó index.html apenas llegó la página; si no, se anota acá.
    if (!(window as any).__brutalOpenSent) fetch(`${API_BASE}/join/open`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, client: clientId(), source }), keepalive: true }).catch(() => {});
  }, [code]);

  async function enter() {
    const nick = nickname.trim();
    if (nick.length < 2) { setError("Poné un apodo de al menos 2 letras."); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, nickname: nick, client: clientId(), source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.message || "No pudimos entrar. Probá de nuevo.");
      save(code, { url: data.url, nickname: data.nickname ?? nick });
      saveShareInfo(code, data.ref);
      window.location.replace(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos entrar. Probá de nuevo.");
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-[380px]">
        <p className="mb-10 font-['Silkscreen'] text-[11px] tracking-widest text-white/40">BRUTAL////////////////</p>

        {saved ? (
          <>
            <h1 className="mb-3 font-['Silkscreen'] text-[26px] leading-tight">YA ENTRASTE</h1>
            <p className="mb-8 font-['Fira_Code'] text-[13px] leading-relaxed text-white/60">Desde este teléfono entraste como <b className="text-white">{saved.nickname}</b>.</p>
            <button onClick={() => window.location.replace(saved.url)} className="mb-3 h-[60px] w-full rounded-full bg-[#E8FF00] font-['Roboto'] text-[17px] font-extrabold text-black active:scale-[0.98]">
              SEGUIR COMO {saved.nickname.toUpperCase()}
            </button>
            <button onClick={() => { forget(code); setSaved(null); }} className="h-[52px] w-full rounded-full border border-white/25 font-['Roboto'] text-[15px] font-bold text-white/80">
              Soy otra persona
            </button>
          </>
        ) : (
          <>
            <h1 className="mb-3 font-['Silkscreen'] text-[26px] leading-tight">¿CÓMO TE DECIMOS?</h1>
            <p className="mb-8 font-['Fira_Code'] text-[13px] leading-relaxed text-white/60">Un apodo. Puede ser el tuyo, puede ser inventado. Es lo único que te pedimos.</p>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 20))}
              onKeyDown={(e) => { if (e.key === "Enter") enter(); }}
              placeholder="Tu apodo"
              autoFocus
              maxLength={20}
              className="mb-4 h-[60px] w-full rounded-2xl border-2 border-white/20 bg-transparent px-5 font-['Roboto'] text-[20px] font-bold text-white outline-none placeholder:text-white/30 focus:border-[#E8FF00]"
            />
            <button onClick={enter} disabled={sending} className="h-[60px] w-full rounded-full bg-[#E8FF00] font-['Roboto'] text-[18px] font-extrabold text-black disabled:opacity-50 active:scale-[0.98]">
              {sending ? "ENTRANDO…" : "ENTRO"}
            </button>
          </>
        )}

        {error && <p className="mt-4 font-['Fira_Code'] text-[12px] text-[#FF6B6B]">{error}</p>}
      </div>
    </div>
  );
}
