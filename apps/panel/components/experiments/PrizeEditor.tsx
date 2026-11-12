"use client";
// ============================================================
// PREMIO — lo que muestra la pantalla final del Drop (se guarda en reveal.prize)
// ============================================================

import type { PrizeConfig } from "./drop-types";

interface Props {
  prize?: PrizeConfig;
  onSave: (prize: PrizeConfig | undefined) => void;
}

export function PrizeEditor({ prize, onSave }: Props) {
  const p = prize ?? {};
  const update = (partial: Partial<PrizeConfig>) => onSave({ ...p, ...partial });
  const input: React.CSSProperties = { backgroundColor: "var(--p-bg-hover)", border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" };
  const label = "text-[10px] uppercase tracking-wider font-bold";
  const field = "w-full rounded-lg px-3 py-2 text-xs outline-none";

  return (
    <div className="flex flex-col gap-3 mt-2">
      <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--p-text-faint)" }}>Premio (pantalla final)</h4>
      <label className="flex flex-col gap-1">
        <span className={label} style={{ color: "var(--p-text-faint)" }}>Imagen del premio (URL; logo en PNG con fondo transparente)</span>
        <input className={field} style={input} value={p.imageUrl ?? ""} onChange={(e) => update({ imageUrl: e.target.value.trim() || undefined })} placeholder="https://..." />
      </label>
      {p.imageUrl && <img src={p.imageUrl} alt="" className="max-h-24 self-start rounded bg-black p-2" />}
      <label className="flex flex-col gap-1">
        <span className={label} style={{ color: "var(--p-text-faint)" }}>Nombre (se muestra en grande si no hay imagen)</span>
        <input className={field} style={input} value={p.title ?? ""} onChange={(e) => update({ title: e.target.value || undefined })} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={label} style={{ color: "var(--p-text-faint)" }}>Premios, uno por renglón</span>
        <textarea className={field} style={input} rows={3} value={(p.lines ?? []).join("\n")} onChange={(e) => update({ lines: e.target.value.split("\n") })} placeholder={"1 FULL PASS\n2 DAY PASS"} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={label} style={{ color: "var(--p-text-faint)" }}>Fecha del sorteo</span>
          <input className={field} style={input} value={p.drawDate ?? ""} onChange={(e) => update({ drawDate: e.target.value || undefined })} placeholder="10-12-26" />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label} style={{ color: "var(--p-text-faint)" }}>Tickets por chance</span>
          <input type="number" min={1} className={field} style={input} value={p.ticketsPerChance ?? 100} onChange={(e) => update({ ticketsPerChance: Math.max(1, Number(e.target.value) || 100) })} />
        </label>
      </div>
    </div>
  );
}
