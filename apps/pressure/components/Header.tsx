'use client';

import { useEffect, useState } from 'react';
import { Flame, Ticket } from 'lucide-react';

/** Reloj de la etapa. Sin deadline queda lleno (la máquina está hablando). */
export type Clock = { totalMs: number; deadline: number | null };

export function TimerPill({ clock }: { clock: Clock | null }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!clock?.deadline) return;
    let raf = 0;
    const tick = () => { setNow(performance.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clock?.deadline]);
  const total = clock?.totalMs ?? 0;
  const left = clock?.deadline ? Math.max(0, clock.deadline - now) : total;
  const pct = total > 0 ? (left / total) * 100 : 100;
  const secs = Math.ceil(left / 1000);
  const urgent = !!clock?.deadline && secs <= 3 && left > 0;
  return (
    <div className={`pill timer ${urgent ? 'urgent' : ''}`} role="timer" aria-label={`${secs} segundos`}>
      <div className="timer-fill" style={{ width: `${pct}%` }}>
        <span>{`00:${String(Math.min(99, secs)).padStart(2, '0')}`}</span>
      </div>
    </div>
  );
}

export function Header({ clock, tickets, multiplier, playing, showTickets = true }: {
  clock: Clock | null; tickets: number; multiplier?: number; playing?: number; showTickets?: boolean;
}) {
  return (
    <header className="bar">
      <div className="bar-top">
        <span className="brand">Brutal<sup>™</sup></span>
        {!!playing && playing > 0 && (
          <span className="playing"><Flame aria-hidden className="flame" /><b>{playing}</b> jugando</span>
        )}
      </div>
      <div className="bar-pills">
        <TimerPill clock={clock} />
        {showTickets && (
          <div className="pill stat tickets" aria-label={`${tickets} Golden Tickets`}>
            <Ticket aria-hidden className="ico" strokeWidth={2.5} />
            <span>{tickets.toLocaleString('es-AR')}</span>
            {!!multiplier && multiplier > 1 && <em>×{String(multiplier).replace('.', ',')}</em>}
          </div>
        )}
      </div>
    </header>
  );
}

export function Dots({ total, current }: { total: number; current: number }) {
  if (total <= 1) return null;
  return (
    <div className="dots" aria-label={`${current + 1} de ${total}`}>
      {Array.from({ length: total }, (_, i) => <i key={i} className={i === current ? 'on' : i < current ? 'done' : ''} />)}
    </div>
  );
}
