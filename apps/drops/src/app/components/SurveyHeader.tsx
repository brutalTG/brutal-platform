// ============================================================
// SURVEY HEADER — Progress bar, timer, stat pills, playing badge
// ============================================================

import { useState, useRef, useEffect } from "react";
import { Flame, DollarSign } from "lucide-react";
import { RewardAnimation, AnimatedStatPill, type RewardEvent } from "./reward-animation";
import { hapticWarning } from "./haptics";
import { TicketIcon } from "./ticket-icon";

/** El ticket de Figma, con la misma interfaz que los íconos de lucide. */
const TicketShape = ({ className }: { className?: string }) => <TicketIcon className={className} style={{ color: "currentColor" }} />;

// --- Avance del Drop: una barra continua pegada al borde de arriba de la pantalla ---
export function StoryProgressBar({ total, current }: { total: number; current: number }) {
  const pct = total > 0 ? Math.min(100, ((current + 1) / total) * 100) : 0;
  return (
    <div
      className="absolute left-0 right-0 h-[6px] z-20"
      style={{ top: "var(--tg-safe-top, 0px)", backgroundColor: "color-mix(in srgb, var(--dynamic-fg, #fff) 28%, transparent)" }}
    >
      <div className="h-full" style={{ width: `${pct}%`, backgroundColor: "var(--dynamic-fg, #fff)", transition: "width 0.4s ease" }} />
    </div>
  );
}

/** La marca arriba a la izquierda. */
export function BrandMark() {
  return <span className="font-['Roboto'] font-bold text-[22px] tracking-tight leading-none" style={{ color: "var(--dynamic-fg, #fff)" }}>Brutal™</span>;
}

// --- Timer Bar ---
export function TimerBar({ duration, onTimeUp }: { duration: number; onTimeUp?: () => void }) {
  const [progress, setProgress] = useState(100);
  const [blinkOn, setBlinkOn] = useState(true);
  const timeUpCalled = useRef(false);

  useEffect(() => {
    const start = Date.now();
    const durationMs = duration * 1000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, durationMs - elapsed);
      const newProgress = (remaining / durationMs) * 100;
      setProgress(newProgress);
      if (newProgress <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [duration]);

  const seconds = Math.ceil((duration * progress) / 100);
  const isBlinking = seconds <= 3 && progress > 0;

  useEffect(() => {
    if (!isBlinking) { setBlinkOn(true); return; }
    hapticWarning();
    const blinkInterval = setInterval(() => setBlinkOn((p) => !p), 250);
    return () => clearInterval(blinkInterval);
  }, [isBlinking]);

  useEffect(() => {
    if (progress <= 0 && !timeUpCalled.current && onTimeUp) {
      timeUpCalled.current = true;
      onTimeUp();
    }
  }, [progress, onTimeUp]);

  const timeString = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  return (
    <div
      className="relative h-[52px] w-full rounded-full overflow-hidden select-none"
      style={{
        backgroundColor: "var(--dynamic-bg, #000)",
        opacity: isBlinking ? (blinkOn ? 1 : 0.1) : 1,
        transition: "opacity 0.15s ease",
      }}
    >
      <div
        className="absolute inset-0 opacity-100"
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, var(--dynamic-fg, #fff) 0, var(--dynamic-fg, #fff) 2px, transparent 2px, transparent 6px)`,
        }}
      />
      {progress > 0 && (
        <div
          className="absolute left-0 top-0 h-full flex items-center justify-center overflow-hidden rounded-l-full"
          style={{
            backgroundColor: "var(--dynamic-fg, #fff)",
            width: `${progress}%`,
            transition: "width 0.05s linear",
          }}
        >
          <span
            className="font-['Roboto'] font-black tracking-tight whitespace-nowrap pl-2 text-[18px]"
            style={{ color: "var(--dynamic-bg, #000)" }}
          >
            {timeString}
          </span>
        </div>
      )}
    </div>
  );
}

// --- Playing Badge ---
export function PlayingBadge() {
  return (
    <div className="flex items-center gap-1.5 font-['Fira_Code'] text-[13px]" style={{ color: "var(--dynamic-fg, #fff)" }}>
      <Flame className="w-4 h-4" style={{ fill: "var(--dynamic-fg, #fff)" }} />
      <span className="font-bold">42</span>
      <span className="font-medium opacity-90">jugando</span>
    </div>
  );
}

// --- Stat Pills Row ---
interface StatPillsProps {
  formattedCoins: string;
  formattedTickets: string;
  rewardEvent: RewardEvent | null;
  isPenalty: boolean;
  isMinor?: boolean;
}

export function StatPills({ formattedCoins, formattedTickets, rewardEvent, isPenalty, isMinor = false }: StatPillsProps) {
  return (
    <div className="flex flex-1 gap-1.5 min-w-0 relative">
      {!isMinor && <AnimatedStatPill
        icon={DollarSign}
        value={formattedCoins}
        className="rounded-l-full rounded-r-[5px] flex-1 px-2"
        flash={!isPenalty && rewardEvent?.type === "coins"}
        key={`coins-${!isPenalty && rewardEvent?.type === "coins" ? rewardEvent.id : "stable"}`}
      />}
      {/* id="ticket-pill": a dónde vuelan los tickets de cada toque (ticket-shower.tsx) */}
      <div id="ticket-pill" className="flex-1 flex min-w-0">
        <AnimatedStatPill
          icon={TicketShape}
          value={formattedTickets}
          className={`${isMinor ? "rounded-full" : "rounded-r-full rounded-l-[5px]"} flex-1 px-2`}
          flash={!isPenalty && rewardEvent?.type === "tickets"}
          shake={isPenalty && rewardEvent?.type === "tickets"}
          key={`tickets-${rewardEvent?.type === "tickets" ? rewardEvent.id : "stable"}`}
        />
      </div>
      <RewardAnimation event={rewardEvent} />
    </div>
  );
}
