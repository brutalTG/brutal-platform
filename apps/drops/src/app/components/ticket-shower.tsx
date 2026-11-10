// ============================================================
// TICKETS QUE VUELAN — cada toque suelta tickets que suben al contador (estilo Candy Crush)
// ============================================================
// - Cualquier toque en un botón dentro de [data-ticket-zone] suelta 3 tickets chicos que vuelan al contador.
// - Cuando una carta paga, sale una lluvia (uno por cada 5 tickets, entre 6 y 16) y el contador rebota.
// - Una pérdida (apuesta, trampa) tira tickets hacia abajo desde el contador.
// Es solo visual: lo que cuenta lo decide el servidor. Respeta "reducir movimiento".
// ============================================================

import { useEffect, useRef } from "react";
import type { RewardEvent } from "./reward-animation";

const TICKET_SVG = `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" fill="currentColor"/><path d="M14 5v12" stroke="rgba(0,0,0,.35)" stroke-dasharray="2 2"/></svg>`;

function reduced() {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

function target(): { x: number; y: number } | null {
  const el = document.getElementById("ticket-pill");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function bounce() {
  const el = document.getElementById("ticket-pill");
  el?.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(0.95)" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
}

/** Suelta n tickets desde (x, y) hacia el contador. */
export function flyTickets(from: { x: number; y: number }, n: number, opts: { size?: number; spread?: number; down?: boolean } = {}) {
  if (typeof document === "undefined" || reduced()) return;
  const to = target();
  if (!to) return;
  const size = opts.size ?? 18;
  const spread = opts.spread ?? 40;
  for (let i = 0; i < n; i++) {
    const t = document.createElement("div");
    t.innerHTML = TICKET_SVG;
    Object.assign(t.style, {
      position: "fixed", left: "0", top: "0", width: `${size}px`, height: `${size}px`, pointerEvents: "none", zIndex: "9999",
      color: "#FFD23F", filter: "drop-shadow(0 2px 2px rgba(0,0,0,.35))",
    } as CSSStyleDeclaration);
    document.body.appendChild(t);
    const sx = opts.down ? to.x : from.x + (Math.random() - 0.5) * spread;
    const sy = opts.down ? to.y : from.y + (Math.random() - 0.5) * spread * 0.5;
    const ex = opts.down ? to.x + (Math.random() - 0.5) * 120 : to.x;
    const ey = opts.down ? to.y + 140 + Math.random() * 80 : to.y;
    // Sube en arco: primero salta hacia arriba y después va al contador.
    const mx = (sx + ex) / 2 + (Math.random() - 0.5) * 120;
    const my = Math.min(sy, ey) - 60 - Math.random() * 80;
    const rot = (Math.random() - 0.5) * 540;
    const anim = t.animate(
      [
        { transform: `translate(${sx - size / 2}px, ${sy - size / 2}px) scale(0.4) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${mx - size / 2}px, ${my - size / 2}px) scale(1.15) rotate(${rot / 2}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${ex - size / 2}px, ${ey - size / 2}px) scale(0.55) rotate(${rot}deg)`, opacity: opts.down ? 0 : 0.9 },
      ],
      { duration: 650 + Math.random() * 250, delay: i * 45, easing: "cubic-bezier(.3,.7,.4,1)", fill: "both" },
    );
    anim.onfinish = () => { t.remove(); if (!opts.down && i === n - 1) bounce(); };
  }
}

/** Monta los efectos: toques dentro de la zona del juego y lluvia cuando una carta paga. */
export function TicketShower({ event }: { event: RewardEvent | null }) {
  const lastTap = useRef<{ x: number; y: number }>({ x: window.innerWidth / 2, y: window.innerHeight * 0.7 });

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      lastTap.current = { x: e.clientX, y: e.clientY };
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-ticket-zone] button, [data-ticket-zone] [role=button], [data-ticket-zone] input[type=range]")) {
        flyTickets(lastTap.current, 3, { size: 14, spread: 24 });
      }
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  useEffect(() => {
    if (!event || event.type !== "tickets") return;
    if (event.penalty) { flyTickets(lastTap.current, Math.min(10, Math.max(4, Math.round(event.value / 5))), { down: true }); return; }
    flyTickets(lastTap.current, Math.min(16, Math.max(6, Math.round(event.value / 5))), { size: 22, spread: 70 });
  }, [event]);

  return null;
}
