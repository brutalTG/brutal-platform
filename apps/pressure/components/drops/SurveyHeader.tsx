'use client';

// Header de Drops (brutal-production/src/app/components/SurveyHeader.tsx + el bloque del header de SurveyApp.tsx).
// Mismo diseño. Cambios para Pressure:
// - El reloj lo maneja el juego (la máquina habla con el reloj lleno; corre cuando escucha).
// - "jugando" muestra el número real, no uno fijo.
// - Pressure no paga plata: la píldora de monedas solo aparece si hay monedas.

import { useEffect, useRef, useState } from 'react';
import { Coins, Flame, Ticket } from 'lucide-react';
import { AnimatedStatPill, RewardAnimation, type RewardEvent } from './reward-animation';
import { hapticWarning } from './haptics';

export type Clock = { totalMs: number; deadline: number | null };

// --- Story Progress Bar ---
export function StoryProgressBar({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-[3px] w-full">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-[2.5px] flex-1 rounded-full"
          style={{
            backgroundColor: i <= current
              ? 'var(--dynamic-fg, #fff)'
              : 'color-mix(in srgb, var(--dynamic-fg, #fff) 20%, transparent)',
          }}
        />
      ))}
    </div>
  );
}

// --- Timer Bar --- (controlado: sin deadline queda lleno)
export function TimerBar({ clock }: { clock: Clock | null }) {
  const [now, setNow] = useState(() => performance.now());
  const [blinkOn, setBlinkOn] = useState(true);
  useEffect(() => {
    if (!clock?.deadline) return;
    const iv = setInterval(() => setNow(performance.now()), 50);
    return () => clearInterval(iv);
  }, [clock?.deadline]);

  const totalMs = clock?.totalMs ?? 0;
  const remaining = clock?.deadline ? Math.max(0, clock.deadline - now) : totalMs;
  const progress = totalMs > 0 ? (remaining / totalMs) * 100 : 100;
  const seconds = Math.ceil(remaining / 1000);
  const isBlinking = !!clock?.deadline && totalMs > 5000 && seconds <= 3 && progress > 0;

  useEffect(() => {
    if (!isBlinking) { setBlinkOn(true); return; }
    hapticWarning();
    const blinkInterval = setInterval(() => setBlinkOn((p) => !p), 250);
    return () => clearInterval(blinkInterval);
  }, [isBlinking]);

  const timeString = `00:${Math.min(99, seconds).toString().padStart(2, '0')}`;
  // Sin reloj corriendo (la máquina habla, una pantalla sin tiempo): solo el rayado, sin números.
  const idle = !clock?.deadline;

  return (
    <div
      className="relative h-[44px] w-full rounded-full overflow-hidden shadow-sm select-none"
      style={{
        backgroundColor: 'var(--dynamic-bg, #000)',
        opacity: isBlinking ? (blinkOn ? 1 : 0.1) : 1,
        transition: 'opacity 0.15s ease',
      }}
    >
      <div
        className="absolute inset-0 opacity-100"
        style={{
          backgroundImage: 'repeating-linear-gradient(135deg, var(--dynamic-fg, #fff) 0, var(--dynamic-fg, #fff) 2px, transparent 2px, transparent 6px)',
        }}
      />
      {!idle && progress > 0 && (
        <div
          className="absolute left-0 top-0 h-full flex items-center justify-center overflow-hidden rounded-l-full"
          style={{ backgroundColor: 'var(--dynamic-fg, #fff)', width: `${progress}%`, transition: 'width 0.05s linear' }}
        >
          <span className="font-['Roboto'] font-extrabold tracking-tight whitespace-nowrap pl-2 text-[16px]" style={{ color: 'var(--dynamic-bg, #000)' }}>
            {timeString}
          </span>
        </div>
      )}
    </div>
  );
}

// --- Playing Badge ---
export function PlayingBadge({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5 font-['Fira_Code'] text-xs mb-1" style={{ color: 'var(--dynamic-fg, #fff)' }}>
      <Flame className="w-4 h-4" style={{ fill: 'var(--dynamic-fg, #fff)' }} />
      <span className="font-bold">{count}</span>
      <span className="font-medium opacity-90">jugando</span>
    </div>
  );
}

// --- Stat Pills Row ---
export function StatPills({ coins, tickets, rewardEvent }: { coins?: number; tickets: number; rewardEvent: RewardEvent | null }) {
  const formattedTickets = tickets.toLocaleString('es-AR');
  const hasCoins = typeof coins === 'number';
  const formattedCoins = !hasCoins ? '' : coins % 1 === 0 ? coins.toString() : coins.toFixed(2).replace('.', ',');
  return (
    <div className="flex w-[55%] gap-1.5 min-w-0 relative">
      {hasCoins && (
        <AnimatedStatPill
          icon={Coins}
          value={formattedCoins}
          className="rounded-l-full rounded-r-[5px] flex-1 px-2"
          flash={rewardEvent?.type === 'coins'}
          key={`coins-${rewardEvent?.type === 'coins' ? rewardEvent.id : 'stable'}`}
        />
      )}
      <AnimatedStatPill
        icon={Ticket}
        value={formattedTickets}
        className={`${hasCoins ? 'rounded-l-[5px]' : 'rounded-l-[5px]'} rounded-r-full flex-1 px-2`}
        flash={!rewardEvent?.penalty && rewardEvent?.type === 'tickets'}
        shake={!!rewardEvent?.penalty && rewardEvent?.type === 'tickets'}
        key={`tickets-${rewardEvent?.type === 'tickets' ? rewardEvent.id : 'stable'}`}
      />
      <RewardAnimation event={rewardEvent} />
    </div>
  );
}

/** El header completo, como en SurveyApp de Drops. */
export function DropHeader({ total, current, clock, tickets, multiplier, playing, rewardEvent }: {
  total: number; current: number; clock: Clock | null; tickets: number; multiplier: number; playing: number;
  rewardEvent: RewardEvent | null;
}) {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-[8] px-5 pointer-events-none"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}
    >
      <div className="w-full mb-3">
        <StoryProgressBar total={Math.max(1, total)} current={current} />
      </div>
      <div className="w-full flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-['Roboto'] font-bold text-[24px] leading-none tracking-[-0.01em]" style={{ color: 'var(--dynamic-fg)' }}>
              Brutal<sup className="text-[11px] align-[0.9em] ml-px">™</sup>
            </span>
            {multiplier > 1 && (
              <span
                className="font-['Fira_Code'] text-[11px] px-2 py-0.5 rounded-full font-bold"
                style={{ color: 'var(--dynamic-fg)', backgroundColor: 'color-mix(in srgb, var(--dynamic-fg) 10%, transparent)' }}
              >
                x{multiplier.toFixed(2).replace(/\.?0+$/, '')}
              </span>
            )}
          </div>
          {playing > 0 && <PlayingBadge count={playing} />}
        </div>
        <div className="flex items-center w-full gap-1.5">
          <div className="w-[45%] shrink-0">
            <TimerBar clock={clock} />
          </div>
          <StatPills tickets={tickets} rewardEvent={rewardEvent} />
        </div>
      </div>
    </div>
  );
}

/** Mismo hook que usa Drops para disparar la animación de +tickets. */
export function useRewardEvent() {
  const [ev, setEv] = useState<RewardEvent | null>(null);
  const id = useRef(0);
  return [ev, (type: RewardEvent['type'], value: number, penalty = false) => setEv({ type, value, penalty, id: ++id.current })] as const;
}
