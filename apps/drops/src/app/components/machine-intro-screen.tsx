// ============================================================
// LA MÁQUINA SE PRESENTA — placa antes de las preguntas por voz.
// El polígrafo arriba, la máquina habla y abajo quedan las reglas del juego.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Polygraph, type PolygraphHandle } from "./polygraph";
import { say } from "./voice-cache";
import { hapticMedium } from "./haptics";

export function MachineIntroScreen({ title, lines, rules, speakText, button = "DALE", onComplete }: {
  /** La frase grande ("¿Creés que le podés mentir a una IA?"). */
  title: string;
  /** Lo que sigue, una línea por vez. */
  lines: string[];
  /** Reglas cortas, en letra chica. */
  rules?: string[];
  /** Lo que dice la voz de la máquina. */
  speakText?: string;
  button?: string;
  onComplete: () => void;
}) {
  const poly = useRef<PolygraphHandle>(null);
  const [shown, setShown] = useState(0); // 0: nada, 1: título, 2..: líneas, después reglas y botón
  const total = 1 + lines.length + 1;

  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Las líneas aparecen a ritmo de lectura, hable o no la máquina.
    let at = 400;
    for (let i = 1; i <= total; i++) {
      timers.push(setTimeout(() => { if (!alive) return; setShown(i); poly.current?.jolt(i === 1 ? 0.6 : 0.3); }, at));
      at += i === 1 ? 1600 : 1300;
    }
    if (speakText) say(speakText).catch(() => {});
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [speakText, total]);

  const ink = "#F2F2F2";
  return (
    <div className="fixed inset-0 flex justify-center overflow-hidden bg-[#050505] font-['Roboto']" style={{ color: ink }}>
      <style>{`@keyframes mi-up { 0% { transform: translateY(12px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }`}</style>
      <div className="flex h-dvh w-full max-w-[420px] flex-col">
        <div className="relative w-full shrink-0" style={{ height: "50dvh" }}>
          <Polygraph ref={poly} fill={0.98} label="La máquina" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16" style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0), #050505)" }} />
          <p className="pointer-events-none absolute font-['Silkscreen'] text-[13px] tracking-wide" style={{ top: "calc(var(--tg-safe-top, 0px) + 16px)", left: 20, textShadow: "0 1px 8px rgba(0,0,0,.8)" }}>
            BRUTAL////////////////
          </p>
        </div>

        <div className="flex flex-1 flex-col px-6 pt-2" style={{ paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 20px)" }}>
          {shown >= 1 && (
            <h1 className="font-['Silkscreen'] text-[26px] leading-[1.1]" style={{ animation: "mi-up 400ms ease-out both" }}>{title}</h1>
          )}
          <div className="mt-4 flex flex-col gap-2">
            {lines.map((l, i) => shown >= 2 + i && (
              <p key={i} className="text-[19px] font-bold leading-snug" style={{ animation: "mi-up 400ms ease-out both" }}>{l}</p>
            ))}
          </div>
          <div className="flex-1" />
          {shown >= total && (
            <div style={{ animation: "mi-up 400ms ease-out both" }}>
              {rules && rules.length > 0 && (
                <div className="mb-4 flex flex-col gap-1">
                  {rules.map((r, i) => <p key={i} className="font-['Fira_Code'] text-[12px] leading-relaxed opacity-70">{r}</p>)}
                </div>
              )}
              <button
                onClick={() => { hapticMedium(); onComplete(); }}
                className="h-[60px] w-full rounded-full text-[18px] font-extrabold active:scale-[0.98]"
                style={{ backgroundColor: "#E8FF00", color: "#000" }}
              >
                {button}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
