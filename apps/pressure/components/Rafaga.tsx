'use client';

import { useEffect, useRef, useState } from 'react';
import type { RafagaItem, Tap } from '@/lib/api';
import { Dots, type Clock } from './Header';

const isVideo = (url?: string | null) => !!url && /\.(mp4|webm|mov|m4v)($|\?)/i.test(url);

/**
 * Ráfaga al tacto: un disparador por vez (texto, imagen o video) y dos emojis grandes.
 * Si no toca a tiempo, pasa solo. Guarda qué tocó y cuánto tardó.
 */
export function Rafaga({ items, seconds, onDone, onClock }: {
  items: RafagaItem[]; seconds: number; onDone: (taps: Tap[]) => void; onClock: (c: Clock | null) => void;
}) {
  const [phase, setPhase] = useState<'count' | 'play' | 'out'>('count');
  const [count, setCount] = useState(3);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<'a' | 'b' | null>(null);
  const [blink, setBlink] = useState(false);
  const taps = useRef<Tap[]>([]);
  const shownAt = useRef(0);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const clockCb = useRef(onClock);
  clockCb.current = onClock;

  // Precarga de imágenes y videos para que no haya huecos.
  useEffect(() => {
    for (const it of items) {
      if (!it.media_url) continue;
      if (isVideo(it.media_url)) { const v = document.createElement('video'); v.preload = 'auto'; v.src = it.media_url; }
      else { const im = new Image(); im.src = it.media_url; }
    }
  }, [items]);

  useEffect(() => {
    if (phase !== 'count') return;
    clockCb.current({ totalMs: seconds * 1000, deadline: null });
    if (count === 0) { setPhase('play'); return; }
    const t = setTimeout(() => setCount((c) => c - 1), 650);
    try { navigator.vibrate?.(20); } catch { /* */ }
    return () => clearTimeout(t);
  }, [phase, count, seconds]);

  function advance(choice: 'a' | 'b' | null) {
    if (lock.current) return;
    lock.current = true;
    if (timer.current) clearTimeout(timer.current);
    const it = items[idx];
    taps.current.push({ item_id: it.id, choice, latency_ms: choice ? Math.round(performance.now() - shownAt.current) : null });
    setPicked(choice);
    clockCb.current({ totalMs: seconds * 1000, deadline: null });
    try { navigator.vibrate?.(choice ? 12 : [30, 30]); } catch { /* */ }
    setTimeout(() => {
      setBlink(true);
      setTimeout(() => {
        if (idx >= items.length - 1) { setPhase('out'); clockCb.current(null); done.current(taps.current); return; }
        setIdx((i) => i + 1);
        setPicked(null);
        setBlink(false);
        lock.current = false;
      }, 140);
    }, choice ? 260 : 60);
  }

  // Cada disparador tiene su tiempo. Si no toca, se va.
  // Un video tiene lo que dura (hasta 8 segundos) más el tiempo normal para tocar.
  function arm(ms: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => advance(null), ms);
    clockCb.current({ totalMs: ms, deadline: performance.now() + ms });
  }
  useEffect(() => {
    if (phase !== 'play') return;
    shownAt.current = performance.now();
    arm(seconds * 1000);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx]);

  function onVideoReady(v: HTMLVideoElement) {
    const d = Number.isFinite(v.duration) ? Math.min(8, v.duration) : 0;
    if (d > 0 && !lock.current) arm(Math.max(0, d * 1000 - (performance.now() - shownAt.current)) + seconds * 1000);
    // Con sonido si el navegador deja; si no, mudo.
    v.muted = false;
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  }

  if (phase === 'count') {
    return (
      <div className="rafaga">
        <div className="rafaga-count">
          <p className="rafaga-title">Ráfaga</p>
          <p className="rafaga-n" key={count}>{count || '¡Ya!'}</p>
          <p className="rafaga-sub">No pienses. Tocá.</p>
        </div>
      </div>
    );
  }
  const it = items[idx];
  if (!it) return null;
  return (
    <div className={`rafaga ${blink ? 'blink' : ''} ${it.media_url ? 'has-media' : ''}`}>
      <div className="rafaga-stage">
        {it.media_url && (isVideo(it.media_url)
          ? <video key={it.id} className="rafaga-media" src={it.media_url} autoPlay muted playsInline onLoadedMetadata={(e) => onVideoReady(e.currentTarget)} />
          // eslint-disable-next-line @next/next/no-img-element
          : <img key={it.id} className="rafaga-media" src={it.media_url} alt="" />)}
        {it.screen_text && <p key={`t-${it.id}`} className={`rafaga-text ${it.media_url ? 'over' : ''}`}>{it.screen_text}</p>}
      </div>
      <div className="rafaga-foot">
        <div className="rafaga-emojis">
          {(['a', 'b'] as const).map((k) => (
            <button key={k} className={`emoji ${picked === k ? 'on' : ''} ${picked && picked !== k ? 'off' : ''}`}
              onPointerDown={() => advance(k)} aria-label={k === 'a' ? it.emoji_a : it.emoji_b}>
              {k === 'a' ? it.emoji_a : it.emoji_b}
            </button>
          ))}
        </div>
        <Dots total={items.length} current={idx} />
      </div>
    </div>
  );
}
