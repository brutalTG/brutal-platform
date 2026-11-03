// ============================================================
// LA MÁQUINA DECIDE — veredicto al cerrar un Drop con cartas de la máquina.
// Primero "está decidiendo" (espera al servidor), después TE AGARRÓ o ZAFASTE.
// ============================================================

import { useEffect, useState } from "react";
import { hapticHeavy, hapticSuccess } from "./haptics";
import type { DetectorVerdict } from "./session-uploader";

const ORDINAL = ["la primera", "la segunda", "la tercera", "la cuarta", "la quinta", "la sexta"];
const label = (p: number) => ORDINAL[p - 1] ?? `la ${p}`;
const clip = (t: string) => (t.length > 90 ? `${t.slice(0, 88).trimEnd()}…` : t);

function summary(v: DetectorVerdict) {
  const n = v.lies.length;
  if (n === 0) return "No mentiste. La máquina igual sospechó.";
  if (v.caught >= n) return n === 1 ? "Encontró tu mentira." : `Encontró tus ${n} mentiras.`;
  if (v.caught === 0) return n === 1 ? "No encontró tu mentira." : `No encontró ninguna de tus ${n} mentiras.`;
  return `Encontró ${v.caught} de tus ${n} mentiras. La otra se le pasó.`;
}

export function DetectorVerdictScreen({ verdict, onContinue }: { verdict: DetectorVerdict | null | "pending"; onContinue: () => void }) {
  const [dots, setDots] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (verdict !== "pending") return;
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, [verdict]);

  useEffect(() => {
    if (verdict === "pending" || !verdict) return;
    // Un respiro antes del golpe.
    const t = setTimeout(() => { setShown(true); if (verdict.verdict === "caught") hapticHeavy(); else hapticSuccess(); }, 900);
    return () => clearTimeout(t);
  }, [verdict]);

  const pending = verdict === "pending";
  const caught = !pending && verdict?.verdict === "caught";
  const bg = pending ? "#000" : caught ? "#FF0040" : "#E8FF00";
  const fg = pending ? "#fff" : "#000";

  return (
    <div className="h-dvh flex flex-col items-center justify-center overflow-y-auto px-6 text-center font-['Roboto']"
      style={{ backgroundColor: bg, color: fg, paddingTop: "var(--tg-safe-top, 0px)", paddingBottom: "var(--tg-safe-bottom, 0px)", transition: "background-color 300ms" }}>
      <style>{`
        @keyframes dv-in { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.06); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes dv-up { 0% { transform: translateY(14px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
      `}</style>

      {(pending || !shown) && (
        <>
          <p className="font-['Fira_Code'] text-xs uppercase tracking-[0.3em] opacity-70">La máquina</p>
          <p className="mt-4 font-['Silkscreen'] text-2xl" style={{ color: pending ? "#fff" : fg }}>
            está decidiendo{".".repeat(dots)}
          </p>
        </>
      )}

      {!pending && verdict && shown && (
        <div className="flex w-full max-w-[380px] flex-col items-center py-10">
          <p className="font-['Fira_Code'] text-xs uppercase tracking-[0.3em]" style={{ animation: "dv-up 300ms ease-out both" }}>La máquina dice</p>
          <h1 className="mt-3 font-['Silkscreen'] leading-none" style={{ fontSize: 44, animation: "dv-in 450ms ease-out both" }}>
            {caught ? "TE AGARRÓ" : "ZAFASTE"}
          </h1>
          <p className="mt-4 text-base font-semibold leading-snug" style={{ animation: "dv-up 400ms 200ms ease-out both" }}>
            {summary(verdict)}
          </p>

          {verdict.cards && verdict.cards.length > 0 ? (
            <div className="mt-6 flex w-full flex-col gap-2 text-left" style={{ animation: "dv-up 400ms 350ms ease-out both" }}>
              {verdict.cards.map((c) => (
                <div key={c.position} className="rounded-2xl px-4 py-3" style={{ backgroundColor: c.lied ? fg : "transparent", color: c.lied ? bg : fg, border: `2px solid ${fg}` }}>
                  <p className="text-[14px] font-bold leading-snug">{c.text}</p>
                  {c.said && <p className="mt-1 text-[13px] leading-snug opacity-80">Dijiste: «{clip(c.said)}»</p>}
                  <p className="mt-2 font-['Fira_Code'] text-[11px] font-bold uppercase tracking-wider">
                    {c.lied ? "Mentiste" : "Verdad"} · {c.accused ? (c.lied ? "te agarró" : "te acusó y era verdad") : c.lied ? "se le pasó" : "no te acusó"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm opacity-80">
              {caught ? `Acusó ${verdict.accused.map(label).join(" y ")}. Ahí mentiste.` : `Acusó ${verdict.accused.map(label).join(" y ")}. Mentiste en ${verdict.lie_labels.join(" y ")}.`}
            </p>
          )}

          <p className="mt-5 text-sm leading-snug opacity-80" style={{ animation: "dv-up 400ms 500ms ease-out both" }}>{verdict.text}</p>
          <p className="mt-6 font-['Fira_Code'] text-lg font-bold" style={{ animation: "dv-up 400ms 600ms ease-out both" }}>
            {verdict.tickets >= 0 ? `+${verdict.tickets}` : verdict.tickets} tickets
          </p>
          <button onClick={onContinue} className="mt-8 rounded-full px-8 py-4 font-bold uppercase tracking-wide active:scale-95"
            style={{ backgroundColor: fg, color: bg, animation: "dv-up 400ms 700ms ease-out both" }}>
            Seguir
          </button>
        </div>
      )}

      {!pending && !verdict && (
        <>
          <p className="font-['Silkscreen'] text-2xl">La máquina se quedó muda.</p>
          <button onClick={onContinue} className="mt-10 rounded-full px-8 py-4 font-bold uppercase tracking-wide" style={{ backgroundColor: "#fff", color: "#000" }}>Seguir</button>
        </>
      )}
    </div>
  );
}
