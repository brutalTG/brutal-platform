// ============================================================
// MAYOR O MENOR — el servidor reparte la carta, el teléfono nunca sabe la que viene.
// Tres modos: escalera (cada acierto sube el multiplicador, plantarse lo asegura),
// multiplicador (una carta: si acertás se activa) y doble o nada (una carta: duplica o borra tus tickets).
// ============================================================

import { useEffect, useRef, useState } from "react";
import { DuotoneCard, CardTitle, ActionButton } from "./brutal-ui";
import { hapticHeavy, hapticMedium } from "./haptics";
import { API_BASE } from "./api-base";
import { userAuthHeaders } from "./access-context";
import { waitForSession } from "./session-uploader";

type View = { card: number; next: number | null; ok: boolean | null; step: number; multiplier: number; ladder: number[]; done: boolean; busted: boolean };
const SUITS = ["s", "h", "d", "c"];
const NAMES: Record<number, string> = { 1: "As", 11: "J", 12: "Q", 13: "K" };
const src = (v: number, s: string) => `/cards/${v}${s}.webp`;

export function MayorMenorQuestion({ text, position, questionId, secondsPerCard = 15, mode = "ladder", tickets = 0, onDone }: {
  text?: string; position: number; questionId: string; secondsPerCard?: number;
  mode?: "ladder" | "multiplier" | "double"; tickets?: number;
  onDone: (r: { multiplier: number; busted: boolean; steps: number }) => void;
}) {
  const [view, setView] = useState<View | null>(null);
  const [suit, setSuit] = useState(SUITS[Math.floor(Math.random() * 4)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(secondsPerCard);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);
  const finished = useRef(false);
  // Lo que se arriesga en doble o nada: los tickets al llegar a la carta (después cambian con el resultado).
  const stakeTickets = useRef(tickets).current;

  async function call(action: "start" | "higher" | "lower" | "stand", atStep?: number) {
    const sessionId = await waitForSession();
    if (!sessionId) { setError("Se cortó la conexión. Tocá para reintentar."); return null; }
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(`${API_BASE}/hilo`, {
          method: "POST", headers: userAuthHeaders(),
          body: JSON.stringify({ session_id: sessionId, position, question_id: questionId, action, at_step: atStep }),
        });
        if (res.ok) { setError(null); return (await res.json()) as View; }
      } catch { /* reintenta */ }
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
    setError("Se cortó la conexión. Tocá para reintentar.");
    return null;
  }

  const finish = (v: View) => {
    if (finished.current) return;
    finished.current = true;
    setTimeout(() => onDone({ multiplier: v.multiplier, busted: v.busted, steps: v.step }), v.busted ? 1400 : 900);
  };

  useEffect(() => {
    for (let v = 1; v <= 13; v++) for (const s of SUITS) { const im = new Image(); im.src = src(v, s); }
    call("start").then((v) => { if (v) { setView(v); if (v.done) finish(v); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tiempo para decidir cada carta: si se acaba, se planta solo.
  useEffect(() => {
    if (!view || view.done) return;
    setLeft(secondsPerCard);
    const t0 = Date.now();
    const iv = setInterval(() => {
      const l = Math.max(0, secondsPerCard - Math.floor((Date.now() - t0) / 1000));
      setLeft(l);
      if (l <= 0) { clearInterval(iv); act("stand"); }
    }, 250);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.step, view?.done]);

  async function act(action: "higher" | "lower" | "stand") {
    if (!view || view.done || busy) return;
    setBusy(true);
    hapticMedium();
    const v = await call(action, action === "stand" ? undefined : view.step);
    setBusy(false);
    if (!v) return;
    if (action !== "stand") {
      setFlash(v.busted ? "bad" : "ok");
      if (v.busted) hapticHeavy();
      setTimeout(() => setFlash(null), 600);
      setSuit(SUITS[Math.floor(Math.random() * 4)]);
    }
    setView(v.busted ? { ...v, card: v.next ?? v.card } : v);
    if (v.done) finish(v);
  }

  const nextMult = view && !view.done ? view.ladder[Math.min(view.step, view.ladder.length - 1)] : null;
  const ink = "var(--dynamic-bg, #000)";
  const single = mode !== "ladder";
  const target = view?.ladder[0] ?? 1.5;
  const hint = mode === "double" ? "Doble o nada" : mode === "multiplier" ? "Activá el multiplicador" : "Mayor o menor";
  const title = text || (mode === "double" ? "¿Doble o nada?" : mode === "multiplier" ? `Acertá y activás x${target}` : "¿La que sigue es mayor o menor?");
  const stake = mode === "double"
    ? (stakeTickets > 0 ? `Llevás ${stakeTickets.toLocaleString("es-AR")} tickets. Si acertás, ${(stakeTickets * 2).toLocaleString("es-AR")}. Si errás, cero.` : "Todavía no tenés tickets: no arriesgás nada.")
    : mode === "multiplier" ? `x${target} sobre todos tus tickets al final del drop. Si errás, no perdés nada.` : null;
  const result = !view?.done ? null
    : mode === "double"
      ? (view.busted ? "Nada. Te quedaste sin tickets." : view.multiplier > 1 ? `Doble: ${(stakeTickets * 2).toLocaleString("es-AR")} tickets.` : "Pasaste. Te quedás con lo que tenías.")
      : mode === "multiplier"
        ? (view.busted ? "No se activó." : view.multiplier > 1 ? `Multiplicador x${view.multiplier} activado.` : "Sin multiplicador.")
        : (view.busted ? "Perdiste el multiplicador." : `Te llevás x${view.multiplier} en Golden Tickets.`);

  return (
    <div className="flex flex-col flex-1 gap-5">
      <DuotoneCard hint={hint}>
        <CardTitle size="md">{title}</CardTitle>
        {stake && <p className="-mt-2 mb-3 text-center font-['Roboto'] text-sm font-semibold" style={{ color: ink }}>{stake}</p>}

        <div className="mb-4 flex w-full items-center justify-between font-['Fira_Code'] text-xs" style={{ color: ink }}>
          <span>{single ? "¿La que sigue es mayor o menor?" : `Multiplicador x${view ? view.multiplier : 1}`}</span>
          {view && !view.done && <span>{left}s</span>}
        </div>

        <div className="relative mb-5 flex h-[210px] items-center justify-center">
          {view ? (
            <img
              key={`${view.card}-${view.step}-${suit}`}
              src={src(view.card, suit)}
              alt={NAMES[view.card] ?? String(view.card)}
              className="h-[200px] w-auto rounded-xl shadow-lg"
              style={{ outline: flash ? `4px solid ${flash === "ok" ? "#21c45d" : "#e5484d"}` : "none", transition: "outline 120ms" }}
            />
          ) : (
            <div className="font-['Fira_Code'] text-sm" style={{ color: ink }}>{error ?? "Mezclando…"}</div>
          )}
        </div>

        {view && !single && (
          <div className="mb-4 flex w-full justify-between gap-1">
            {view.ladder.map((m, i) => (
              <span key={m} className="flex-1 rounded-full py-1 text-center font-['Fira_Code'] text-[11px] font-bold"
                style={{ backgroundColor: i < view.step && !view.busted ? ink : "transparent", color: i < view.step && !view.busted ? "var(--dynamic-fg, #fff)" : ink, border: `1px solid ${ink}` }}>
                x{m}
              </span>
            ))}
          </div>
        )}

        {error && view && <button onClick={() => setError(null)} className="mb-2 text-sm underline" style={{ color: ink }}>{error}</button>}

        {view && !view.done && (
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full gap-2">
              <button disabled={busy} onClick={() => act("higher")} className="h-14 flex-1 rounded-full text-lg font-bold active:scale-95" style={{ backgroundColor: ink, color: "var(--dynamic-fg, #fff)" }}>Mayor 👍</button>
              <button disabled={busy} onClick={() => act("lower")} className="h-14 flex-1 rounded-full text-lg font-bold active:scale-95" style={{ backgroundColor: ink, color: "var(--dynamic-fg, #fff)" }}>Menor 👎</button>
            </div>
            {!single && view.step > 0 && <ActionButton label={`Me planto en x${view.multiplier}`} onClick={() => act("stand")} variant="pill" />}
            {mode === "double" && stakeTickets > 0 && <ActionButton label="Paso, me quedo con lo que tengo" onClick={() => act("stand")} variant="pill" />}
            {view.step === 0 && <p className="text-center font-['Fira_Code'] text-[11px]" style={{ color: ink }}>{single ? "Empate cuenta como acierto." : `Empate cuenta como acierto. Si acertás, pasás a x${nextMult}.`}</p>}
          </div>
        )}

        {view?.done && (
          <p className="text-center font-['Roboto'] text-lg font-bold" style={{ color: ink }}>
            {result}
          </p>
        )}
      </DuotoneCard>
    </div>
  );
}
