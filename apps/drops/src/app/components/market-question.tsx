// ============================================================
// MERCADO — carta de predicción tipo Polymarket
// ============================================================
// "¿Qué eligió la mayoría del club?" Cada opción cotiza en centavos (= probabilidad que le da el mercado).
// Comprás una opción con tickets; si es la que más eligió el club, cobrás apuesta ÷ precio.
// Comprar barato (23¢) paga mucho (x4,3); comprar el favorito (61¢) paga poco (x1,6).
// El precio es lo que cree el resto; quién gana lo decide lo que el club contestó de verdad.
// ============================================================

import { useMemo, useState } from "react";
import { hapticLight, hapticMedium } from "./haptics";
import { flyTickets } from "./ticket-shower";

export interface MarketOutcome { label: string; price: number }

interface Props {
  actionHint?: string;
  /** La pregunta del mercado, ej. "¿Qué eligió la mayoría del club?" */
  text: string;
  /** La carta a la que apunta, para recordarla (ej. "Primera cita perfecta…"). */
  refText?: string;
  outcomes: MarketOutcome[];
  /** Tickets que se pueden apostar (los que lleva en la partida). */
  available: number;
  stakes?: number[];
  volume?: number;
  traders?: number;
  onConfirm: (outcomeIndex: number, stake: number, price: number) => void;
}

/** Gráfico de precio inventado pero estable (mismo texto, misma curva) que termina en el precio actual. */
function sparkPath(seed: string, end: number, w = 280, h = 56) {
  let x = 0; for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => ((x = (x * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const n = 28; const pts: number[] = []; let v = Math.max(5, Math.min(95, end + (rand() - 0.5) * 30));
  for (let i = 0; i < n; i++) { v += (rand() - 0.5) * 9 + (end - v) * (i / n) * 0.35; pts.push(Math.max(2, Math.min(98, v))); }
  pts[n - 1] = end;
  return pts.map((p, i) => `${i ? "L" : "M"}${((i / (n - 1)) * w).toFixed(1)},${(h - (p / 100) * h).toFixed(1)}`).join(" ");
}

export const payoutOf = (stake: number, price: number) => Math.round((stake * 100) / Math.max(1, price));

export function MarketQuestion({ actionHint, text, refText, outcomes, available, stakes = [10, 25, 50], volume, traders, onConfirm }: Props) {
  const [pick, setPick] = useState<number | null>(null);
  const cap = Math.max(10, available);
  const chips = useMemo(() => [...stakes.filter((s) => s <= cap), ...(cap > Math.max(...stakes) ? [cap] : [])], [stakes, cap]);
  const [stake, setStake] = useState<number>(chips[Math.min(1, chips.length - 1)] ?? 10);
  const leader = outcomes.reduce((b, o, i) => (o.price > outcomes[b].price ? i : b), 0);
  const chosen = pick == null ? null : outcomes[pick];
  const win = chosen ? payoutOf(stake, chosen.price) : 0;
  const fg = "var(--dynamic-fg, #fff)";
  const bg = "var(--dynamic-bg, #000)";

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center justify-between font-['Fira_Code'] text-[11px] uppercase tracking-widest" style={{ color: fg }}>
        <span className="px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: fg, color: bg }}>Mercado</span>
        <span className="opacity-70">{actionHint}</span>
      </div>

      {refText && <p className="font-['Roboto'] text-[14px] leading-snug opacity-75" style={{ color: fg }}>“{refText}”</p>}
      <h2 className="font-['Roboto'] font-extrabold text-[24px] leading-tight" style={{ color: fg }}>{text}</h2>

      <div className="flex items-end justify-between font-['Fira_Code'] text-[11px] opacity-70" style={{ color: fg }}>
        <span>{outcomes[leader].label} · {outcomes[leader].price}% de chance</span>
        {volume ? <span>🎟 {volume.toLocaleString("es-AR")} en juego{traders ? ` · ${traders}` : ""}</span> : null}
      </div>
      <svg viewBox="0 0 280 56" className="w-full h-14" aria-hidden>
        <path d={sparkPath(text, outcomes[leader].price)} fill="none" stroke={fg} strokeWidth="2" strokeLinejoin="round" />
      </svg>

      <div className="flex flex-col gap-2">
        {outcomes.map((o, i) => {
          const on = pick === i;
          return (
            <button key={o.label} onClick={() => { hapticLight(); setPick(i); }}
              className="relative w-full overflow-hidden rounded-xl border-2 text-left transition-transform active:scale-[0.98]"
              style={{ borderColor: fg, backgroundColor: on ? fg : "transparent", color: on ? bg : fg }}>
              <span className="absolute inset-y-0 left-0 opacity-20" style={{ width: `${o.price}%`, backgroundColor: on ? bg : fg }} />
              <span className="relative flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-bold text-[16px] leading-tight">{o.label}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-['Fira_Code'] text-[13px] opacity-80">{o.price}%</span>
                  <span className="font-['Fira_Code'] font-bold text-[14px] px-2 py-1 rounded-md" style={{ backgroundColor: on ? bg : fg, color: on ? fg : bg }}>{o.price}¢</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {chosen && (
        <div className="flex flex-col gap-3 rounded-2xl p-4" style={{ backgroundColor: `color-mix(in srgb, ${fg} 12%, transparent)`, color: fg }}>
          <div className="flex gap-2">
            {chips.map((c) => (
              <button key={c} onClick={() => { hapticLight(); setStake(c); }}
                className="flex-1 py-2 rounded-full font-['Fira_Code'] font-bold text-[14px] border-2"
                style={{ borderColor: fg, backgroundColor: stake === c ? fg : "transparent", color: stake === c ? bg : fg }}>
                {c === cap && c > Math.max(...stakes) ? "TODO" : c} 🎟
              </button>
            ))}
          </div>
          <div className="flex items-baseline justify-between font-['Fira_Code'] text-[13px]">
            <span className="opacity-80">Si gana “{chosen.label}”</span>
            <span className="font-bold text-[20px]">+{win} 🎟 <span className="text-[12px] opacity-70">x{(100 / chosen.price).toFixed(1).replace(".", ",")}</span></span>
          </div>
          <button
            onClick={(e) => {
              hapticMedium();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              flyTickets({ x: r.left + r.width / 2, y: r.top }, 8, { down: true });
              onConfirm(pick!, stake, chosen.price);
            }}
            className="w-full py-4 rounded-full font-['Roboto'] font-extrabold text-[18px] tracking-wide active:scale-[0.98]"
            style={{ backgroundColor: fg, color: bg }}>
            COMPRAR “{chosen.label}” · {stake} 🎟
          </button>
          <p className="text-center font-['Fira_Code'] text-[11px] opacity-60">Se resuelve con lo que contestó el club.</p>
        </div>
      )}
    </div>
  );
}
