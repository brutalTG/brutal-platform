'use client';

// Ráfaga con los componentes de Drops: intro + cuenta 3-2-1 rápida (rafaga-emoji-question),
// card con texto y dos emojis (rafaga-burst-question) o imagen/video a pantalla completa (media-reaction-question).
// El duotono cambia en cada toque (lo pide el juego con onTick).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RafagaItem, Tap } from '@/lib/api';
import type { Clock } from './drops/SurveyHeader';
import { hapticHeavy, hapticLight, hapticRigid } from './drops/haptics';

const isVideo = (url?: string | null) => !!url && /\.(mp4|webm|mov|m4v)($|\?)/i.test(url);
const BLINK_STEPS = [1, 0, 1, 0, 1, 0, 1];
const BLINK_STEP_MS = 45;
const BLINK_SWAP_AT = 3;
const POST_SELECT_DELAY = 250;

export function Rafaga({ items, seconds, onDone, onClock, onTick }: {
  items: RafagaItem[]; seconds: number; onDone: (taps: Tap[]) => void; onClock: (c: Clock | null) => void; onTick: () => void;
}) {
  const [phase, setPhase] = useState<'intro' | 'countdown' | 'active'>('intro');
  const [countdownNum, setCountdownNum] = useState(3);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<'a' | 'b' | null>(null);
  const [blinkOpacity, setBlinkOpacity] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const taps = useRef<Tap[]>([]);
  const idxRef = useRef(0);
  const shownAt = useRef(0);
  const lock = useRef(false);
  const completed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cb = useRef({ onDone, onClock, onTick });
  cb.current = { onDone, onClock, onTick };

  // Precarga de imágenes y videos para que no haya huecos.
  useEffect(() => {
    for (const it of items) {
      if (!it.media_url) continue;
      if (isVideo(it.media_url)) { const v = document.createElement('video'); v.preload = 'auto'; v.src = it.media_url; }
      else { const im = new Image(); im.src = it.media_url; }
    }
  }, [items]);

  // Intro 1,5 s y cuenta 3-2-1 rápida (350 ms cada número), como en Drops.
  useEffect(() => {
    cb.current.onClock({ totalMs: seconds * 1000, deadline: null });
    if (phase === 'intro') { const t = setTimeout(() => setPhase('countdown'), 1500); return () => clearTimeout(t); }
    if (phase !== 'countdown') return;
    setCountdownNum(3); hapticRigid();
    const t1 = setTimeout(() => { setCountdownNum(2); hapticRigid(); }, 350);
    const t2 = setTimeout(() => { setCountdownNum(1); hapticRigid(); }, 700);
    const t3 = setTimeout(() => { hapticHeavy(); setPhase('active'); }, 1050);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [phase, seconds]);

  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    cb.current.onClock(null);
    setTimeout(() => cb.current.onDone([...taps.current]), 300);
  }, []);

  // Parpadeo entre cards (Drops). En el medio del parpadeo cambia el duotono y la card.
  const blinkTo = useCallback((next: number) => {
    setTransitioning(true);
    clearTimer();
    hapticRigid();
    let step = 0;
    const iv = setInterval(() => {
      if (step < BLINK_STEPS.length) {
        setBlinkOpacity(BLINK_STEPS[step]);
        if (step === BLINK_SWAP_AT) {
          cb.current.onTick();
          if (next >= items.length) finish();
          else { idxRef.current = next; setIdx(next); setSelected(null); }
        }
        step++;
      } else {
        clearInterval(iv);
        setBlinkOpacity(1);
        setTransitioning(false);
        lock.current = false;
      }
    }, BLINK_STEP_MS);
  }, [items.length, finish]);

  const answer = useCallback((choice: 'a' | 'b' | null) => {
    if (lock.current || completed.current) return;
    lock.current = true;
    clearTimer();
    const it = items[idxRef.current];
    taps.current.push({ item_id: it.id, choice, latency_ms: choice ? Math.round(performance.now() - shownAt.current) : null });
    cb.current.onClock({ totalMs: seconds * 1000, deadline: null });
    if (choice) { hapticLight(); setSelected(choice); }
    setTimeout(() => blinkTo(idxRef.current + 1), choice ? POST_SELECT_DELAY : 0);
  }, [items, seconds, blinkTo]);

  // Cada card tiene su tiempo. Un video tiene lo que dura (hasta 8 s) más el tiempo normal para tocar.
  const arm = useCallback((ms: number) => {
    clearTimer();
    timer.current = setTimeout(() => answer(null), ms);
    cb.current.onClock({ totalMs: ms, deadline: performance.now() + ms });
  }, [answer]);

  useEffect(() => {
    if (phase !== 'active' || transitioning) return;
    shownAt.current = performance.now();
    arm(seconds * 1000);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, transitioning]);

  function onVideoReady(v: HTMLVideoElement) {
    const d = Number.isFinite(v.duration) ? Math.min(8, v.duration) : 0;
    if (d > 0 && !lock.current) arm(Math.max(0, d * 1000 - (performance.now() - shownAt.current)) + seconds * 1000);
    v.muted = false;
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  }

  if (phase === 'intro') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-8" style={{ backgroundColor: 'var(--dynamic-bg, #000)' }}>
        <p className="font-['Roboto'] font-bold text-center leading-tight m-0" style={{ color: 'var(--dynamic-fg, #fff)', fontSize: 26 }}>
          {items.length} rápidas, {seconds} segundos cada una, reaccioná
        </p>
      </div>
    );
  }
  if (phase === 'countdown') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'var(--dynamic-bg, #000)' }}>
        <span className="font-['Roboto'] font-bold text-center leading-none select-none" style={{ color: 'var(--dynamic-fg, #fff)', fontSize: 128 }}>
          {countdownNum}
        </span>
      </div>
    );
  }

  const it = items[idx];
  if (!it) return null;
  const hasMedia = !!it.media_url;
  const emojis = (size: number, gap: string) => (
    <div className={`flex items-center justify-center ${gap} w-full`}>
      {(['a', 'b'] as const).map((k) => {
        const isSel = selected === k, dim = selected !== null && !isSel;
        return (
          <button
            key={k}
            data-emoji={k}
            onClick={() => answer(k)}
            aria-label={k === 'a' ? it.emoji_a : it.emoji_b}
            className="flex items-center justify-center select-none active:scale-110 bg-transparent border-0 p-0 cursor-pointer"
            style={{
              transform: isSel ? 'scale(1.2)' : dim ? 'scale(0.85)' : 'scale(1)',
              opacity: dim ? 0.25 : 1,
              transition: 'transform 0.2s ease, opacity 0.2s ease',
              filter: hasMedia ? 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' : undefined,
            }}
          >
            <span className="select-none" style={{ fontSize: size, lineHeight: 1 }}>{k === 'a' ? it.emoji_a : it.emoji_b}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      data-rafaga={hasMedia ? 'media' : 'text'}
      className="absolute inset-0 z-[6] overflow-hidden flex flex-col"
      style={{ backgroundColor: transitioning ? 'var(--dynamic-fg)' : 'var(--dynamic-bg)' }}
    >
      {hasMedia && (
        <div className="absolute inset-0" style={{ opacity: blinkOpacity }}>
          {isVideo(it.media_url)
            ? <video key={it.id} src={it.media_url!} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline onLoadedMetadata={(e) => onVideoReady(e.currentTarget)} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img key={it.id} src={it.media_url!} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          {/* Degradé de media-reaction: más oscuro abajo para leer */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.75) 100%)' }} />
        </div>
      )}

      {/* Contador y puntos de rafaga_emoji, debajo del header */}
      <div className="relative z-30 flex flex-col items-center gap-2" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 142px)' }}>
        <span className="font-['Roboto'] font-semibold text-[14px] opacity-50" style={{ color: hasMedia ? '#fff' : 'var(--dynamic-fg, #fff)' }}>
          {idx + 1} / {items.length}
        </span>
        <div className="flex items-center gap-[6px]">
          {items.map((_, i) => (
            <div key={i} className="rounded-full" style={{
              width: 9, height: 9,
              backgroundColor: i <= idx ? (hasMedia ? '#fff' : 'var(--dynamic-fg, #fff)') : 'transparent',
              border: i <= idx ? 'none' : `2px solid color-mix(in srgb, ${hasMedia ? '#fff' : 'var(--dynamic-fg, #fff)'} 30%, transparent)`,
            }} />
          ))}
        </div>
      </div>

      {hasMedia ? (
        // media-reaction: texto opcional y emojis en la zona del pulgar
        <div className="relative z-10 flex-1 flex flex-col items-center" style={{ opacity: blinkOpacity }}>
          <div className="flex-[2]" />
          {it.screen_text && (
            <h2 className="font-['Roboto'] font-bold text-[#fff] text-center leading-tight px-6 max-w-[340px] mb-8 drop-shadow-lg m-0"
              style={{ fontSize: it.screen_text.length > 40 ? '20px' : '26px', marginBottom: 32 }}>
              {it.screen_text}
            </h2>
          )}
          {emojis(80, 'gap-8')}
          <div className="flex-[1]" />
        </div>
      ) : (
        // rafaga_emoji de Drops (la del 🔥/🧊): texto de 36 px y emojis de 72 px, sin marco.
        <div className="relative z-10 flex-1 flex flex-col items-center" style={{ opacity: blinkOpacity }}>
          <div className="flex-[1.5]" />
          <div className="flex flex-col items-center gap-8">
            <h2 className="font-['Roboto'] font-bold text-[36px] text-center leading-tight px-4 m-0" style={{ color: 'var(--dynamic-fg, #fff)' }}>
              {it.screen_text}
            </h2>
            {emojis(72, 'gap-12')}
          </div>
          <div className="flex-[3]" />
        </div>
      )}
    </div>
  );
}
