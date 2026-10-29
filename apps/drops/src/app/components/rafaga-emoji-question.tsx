import { useState, useEffect, useRef, useCallback } from "react";
import { hapticLight, hapticRigid, hapticHeavy } from "./haptics";

export interface RafagaEmojiItem {
  text: string;
  optionA: string;
  optionB: string;
}

interface RafagaEmojiQuestionProps {
  promptBold: string;
  items: RafagaEmojiItem[];
  secondsPerItem?: number;
  onComplete: (answers: (string | null)[], itemLatencyMs: (number | null)[]) => void;
}

const BLINK_STEPS = [1, 0, 1, 0, 1, 0, 1];
const BLINK_STEP_MS = 45;
const BLINK_SWAP_AT = 3;
const POST_SELECT_DELAY = 200;

/**
 * rafaga_emoji — Emoji-button rapid fire.
 *
 * Intro: full-screen clean text + fast countdown with haptics.
 * Active: emojis in subtle glass boxes in the thumb zone; position shown as dots (current = pill), no number.
 */
export function RafagaEmojiQuestion({
  promptBold,
  items,
  secondsPerItem = 3,
  onComplete,
}: RafagaEmojiQuestionProps) {
  const [phase, setPhase] = useState<"intro" | "countdown" | "active">("intro");
  const [countdownNum, setCountdownNum] = useState(3);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [blinkOpacity, setBlinkOpacity] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [subProgress, setSubProgress] = useState(100);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const currentIdxRef = useRef(0);
  const answersRef = useRef<(string | null)[]>(new Array(items.length).fill(null));
  // Latencia de cada ítem: desde que el ítem queda quieto en pantalla hasta el toque.
  const latRef = useRef<(number | null)[]>(new Array(items.length).fill(null));
  const shownAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const transitioningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const total = items.length;
  const item = items[currentIdx];

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Phase 1: Show intro text for 1.5s, then move to countdown
  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("countdown"), 1500);
    return () => clearTimeout(t);
  }, [phase]);

  // Phase 2: Fast countdown 3-2-1 with haptics (350ms each)
  useEffect(() => {
    if (phase !== "countdown") return;
    setCountdownNum(3);
    hapticRigid();

    const t1 = setTimeout(() => { setCountdownNum(2); hapticRigid(); }, 350);
    const t2 = setTimeout(() => { setCountdownNum(1); hapticRigid(); }, 700);
    const t3 = setTimeout(() => { hapticHeavy(); setPhase("active"); }, 1050);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase]);

  const doComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setTimeout(() => onCompleteRef.current([...answersRef.current], [...latRef.current]), 300);
  }, []);

  const runBlink = useCallback((nextIdx: number) => {
    if (transitioningRef.current || completedRef.current) return;
    transitioningRef.current = true;
    setTransitioning(true);
    clearTimer();
    hapticRigid();

    let step = 0;
    const interval = setInterval(() => {
      if (step < BLINK_STEPS.length) {
        setBlinkOpacity(BLINK_STEPS[step]);
        if (step === BLINK_SWAP_AT) {
          currentIdxRef.current = nextIdx;
          setCurrentIdx(nextIdx);
          setSelectedOption(null);
        }
        step++;
      } else {
        clearInterval(interval);
        setBlinkOpacity(1);
        transitioningRef.current = false;
        setTransitioning(false);
      }
    }, BLINK_STEP_MS);
  }, []);

  const advance = useCallback(() => {
    if (completedRef.current || transitioningRef.current) return;
    const idx = currentIdxRef.current;
    if (idx >= total - 1) doComplete();
    else runBlink(idx + 1);
  }, [total, doComplete, runBlink]);

  useEffect(() => {
    if (phase !== "active" || completedRef.current || transitioning) return;
    timerRef.current = setTimeout(advance, secondsPerItem * 1000);
    return clearTimer;
  }, [phase, currentIdx, secondsPerItem, advance, transitioning]);

  const handleSelect = useCallback(
    (option: string) => {
      if (transitioningRef.current || completedRef.current) return;
      clearTimer();
      hapticLight();
      if (shownAtRef.current !== null) latRef.current[currentIdxRef.current] = Math.round(performance.now() - shownAtRef.current);
      answersRef.current[currentIdxRef.current] = option;
      setSelectedOption(option);

      const idx = currentIdxRef.current;
      const isLast = idx >= total - 1;
      setTimeout(() => {
        if (isLast) doComplete();
        else runBlink(idx + 1);
      }, POST_SELECT_DELAY);
    },
    [total, doComplete, runBlink]
  );

  useEffect(() => {
    if (phase !== "active" || completedRef.current || transitioning) return;
    shownAtRef.current = performance.now();
    setSubProgress(100);
    const start = Date.now();
    const dur = secondsPerItem * 1000;
    const interval = setInterval(() => {
      const rem = Math.max(0, dur - (Date.now() - start));
      setSubProgress((rem / dur) * 100);
      if (rem <= 0) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [phase, currentIdx, secondsPerItem, transitioning]);

  // ── Intro: clean full-screen text ──
  if (phase === "intro") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-8"
        style={{ backgroundColor: "var(--dynamic-bg, #000)" }}
      >
        <p
          className="font-['Roboto'] font-bold text-center leading-tight"
          style={{ color: "var(--dynamic-fg, #fff)", fontSize: 26 }}
        >
          {items.length} rapidas, {secondsPerItem} segundos cada una, reacciona
        </p>
      </div>
    );
  }

  // ── Countdown: clean full-screen number ──
  if (phase === "countdown") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: "var(--dynamic-bg, #000)" }}
      >
        <span
          className="font-['Roboto'] font-bold text-center leading-none select-none"
          style={{
            color: "var(--dynamic-fg, #fff)",
            fontSize: 128,
          }}
        >
          {countdownNum}
        </span>
      </div>
    );
  }

  // ── Active ──
  const isA = selectedOption === item.optionA;
  const isB = selectedOption === item.optionB;

  return (
    <div className="flex flex-col flex-1 items-center">
      {/* Position: dots, the current one stretches into a pill. No number. */}
      <div className="flex items-center justify-center gap-[8px] mt-1">
        {items.map((_, i) => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: i === currentIdx ? 34 : 10,
              height: 10,
              backgroundColor: i === currentIdx
                ? "var(--dynamic-fg, #fff)"
                : "color-mix(in srgb, var(--dynamic-fg, #fff) 35%, transparent)",
              transition: "width 0.25s ease, background-color 0.25s ease",
            }}
          />
        ))}
      </div>

      {/* Top spacer */}
      <div className="flex-1" />

      {/* Stimulus text */}
      <h2
        className="font-['Roboto'] font-bold text-[36px] text-center leading-tight px-4"
        style={{ color: "var(--dynamic-fg, #fff)", opacity: blinkOpacity }}
      >
        {item.text}
      </h2>

      <div className="flex-1" />

      {/* Emoji buttons — subtle glass boxes in the thumb zone, no shadows */}
      <div className="flex items-center justify-center gap-10 mb-8" style={{ opacity: blinkOpacity }}>
        {[{ emoji: item.optionA, on: isA }, { emoji: item.optionB, on: isB }].map(({ emoji, on }, i) => (
          <button
            key={i}
            onClick={() => handleSelect(emoji)}
            className="flex items-center justify-center select-none active:scale-95"
            style={{
              width: 112,
              height: 112,
              borderRadius: 16,
              backgroundColor: `color-mix(in srgb, var(--dynamic-fg, #fff) ${on ? 16 : 7}%, transparent)`,
              border: `1px solid color-mix(in srgb, var(--dynamic-fg, #fff) ${on ? 55 : 14}%, transparent)`,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              transform: on ? "scale(1.06)" : "scale(1)",
              transition: "transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease",
            }}
          >
            <span style={{ fontSize: 64, lineHeight: 1 }}>{emoji}</span>
          </button>
        ))}
      </div>

      {/* Sub-timer */}
      <div className="w-full h-[3px] rounded-full overflow-hidden mb-1" style={{ backgroundColor: "color-mix(in srgb, var(--dynamic-fg, #fff) 10%, transparent)" }}>
        <div
          className="h-full rounded-full"
          style={{ backgroundColor: "var(--dynamic-fg, #fff)", width: `${subProgress}%`, transition: "width 0.03s linear" }}
        />
      </div>
    </div>
  );
}
