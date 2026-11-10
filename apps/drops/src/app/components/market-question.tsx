// ============================================================
// PREDICCIÓN — "¿qué eligió la mayoría del club?"
// ============================================================
// Todas las opciones pagan lo mismo: sin precios, sin favorito y sin apuesta, para que nadie conteste
// pensando en la cuota. Si acertás lo que eligió la mayoría, sumás `payout` tickets; si no, no sumás nada.
// Quién gana lo decide lo que contestó el club (reales + club simulado), al cerrar la partida.
// ============================================================

import { useState } from "react";
import { hapticLight, hapticMedium } from "./haptics";

interface Props {
  actionHint?: string;
  text: string;
  /** La carta a la que apunta, para recordarla (ej. "Primera cita perfecta…"). */
  refText?: string;
  options: string[];
  payout: number;
  traders?: number;
  onConfirm: (outcomeIndex: number) => void;
}

export function MarketQuestion({ actionHint, text, refText, options, payout, traders, onConfirm }: Props) {
  const [pick, setPick] = useState<number | null>(null);
  const fg = "var(--dynamic-fg, #fff)";
  const bg = "var(--dynamic-bg, #000)";

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between font-['Fira_Code'] text-[11px] uppercase tracking-widest" style={{ color: fg }}>
        <span className="px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: fg, color: bg }}>Predicción</span>
        <span className="opacity-70">{actionHint}</span>
      </div>

      {refText && <p className="font-['Roboto'] text-[14px] leading-snug opacity-75" style={{ color: fg }}>“{refText}”</p>}
      <h2 className="font-['Roboto'] font-extrabold text-[24px] leading-tight" style={{ color: fg }}>{text}</h2>
      <p className="font-['Fira_Code'] text-[13px] font-bold" style={{ color: fg }}>
        Si acertás: +{payout} 🎟{traders ? <span className="font-normal opacity-60"> · {traders} jugando</span> : null}
      </p>

      <div className="flex flex-col gap-2">
        {options.map((o, i) => {
          const on = pick === i;
          return (
            <button key={o} onClick={() => { hapticLight(); setPick(i); }}
              className="w-full rounded-xl border-2 px-4 py-3 text-left font-bold text-[16px] leading-tight transition-transform active:scale-[0.98]"
              style={{ borderColor: fg, backgroundColor: on ? fg : "transparent", color: on ? bg : fg }}>
              {o}
            </button>
          );
        })}
      </div>

      <button
        disabled={pick == null}
        onClick={() => { if (pick == null) return; hapticMedium(); onConfirm(pick); }}
        className="w-full py-4 rounded-full font-['Roboto'] font-extrabold text-[18px] tracking-wide active:scale-[0.98] transition-opacity"
        style={{ backgroundColor: fg, color: bg, opacity: pick == null ? 0.35 : 1 }}>
        {pick == null ? "ELEGÍ UNA" : "ESA GANA"}
      </button>
      <p className="text-center font-['Fira_Code'] text-[11px] opacity-60" style={{ color: fg }}>El resultado lo ves al final.</p>
    </div>
  );
}
