'use client';

import { useEffect, useRef, useState } from 'react';
import type { HiloView } from '@/lib/api';
import type { Clock } from './Header';

const SUITS = ['s', 'h', 'd', 'c'] as const;
const NAMES: Record<number, string> = { 1: 'As', 11: 'Jota', 12: 'Reina', 13: 'Rey' };
const fmtX = (m: number) => `x${String(m).replace('.', ',')}`;
const cardSrc = (v: number, s: string) => `/cards/${v}${s}.webp`;
const DECIDE_MS = 15_000;

/**
 * Mayor o menor. La API reparte: el navegador nunca sabe la carta que viene.
 * Tiene 15 segundos para decidir; si no decide, se planta solo.
 * Devuelve el multiplicador con el que se quedó (1 si perdió o no apostó).
 */
export function Hilo({ play, onDone, onClock }: {
  play: (action: 'start' | 'higher' | 'lower' | 'stand', step?: number) => Promise<HiloView>;
  onDone: (multiplier: number) => void; onClock: (c: Clock | null) => void;
}) {
  const [view, setView] = useState<HiloView | null>(null);
  const [busy, setBusy] = useState(false);
  const [deal, setDeal] = useState<{ prev: string; ok: boolean } | null>(null);
  const [end, setEnd] = useState<{ multiplier: number; busted: boolean } | null>(null);
  const [suit, setSuit] = useState<string>(() => SUITS[Math.floor(Math.random() * 4)]);
  const done = useRef(onDone);
  done.current = onDone;
  const clockCb = useRef(onClock);
  clockCb.current = onClock;
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const act = useRef<(a: 'higher' | 'lower' | 'stand') => void>(() => {});

  useEffect(() => {
    play('start').then((v) => {
      setView(v);
      if (v.done) finish(v.multiplier, !!v.busted);
    }).catch(() => done.current(1));
    // Precarga del mazo: son livianas y así no hay salto al dar vuelta.
    for (let v = 1; v <= 13; v++) for (const s of SUITS) { const im = new Image(); im.src = cardSrc(v, s); }
    return () => { if (timeout.current) clearTimeout(timeout.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reloj de decisión: arranca cada vez que hay una carta nueva en la mesa.
  useEffect(() => {
    if (!view || end || busy) return;
    clockCb.current({ totalMs: DECIDE_MS, deadline: performance.now() + DECIDE_MS });
    timeout.current = setTimeout(() => act.current('stand'), DECIDE_MS);
    return () => { if (timeout.current) clearTimeout(timeout.current); };
  }, [view, end, busy]);

  function finish(multiplier: number, busted: boolean) {
    setEnd({ multiplier, busted });
    clockCb.current({ totalMs: DECIDE_MS, deadline: null });
    try { navigator.vibrate?.(busted ? [200] : [30, 40, 30, 40, 60]); } catch { /* */ }
    setTimeout(() => { clockCb.current(null); done.current(multiplier); }, busted ? 1900 : 1700);
  }

  act.current = async (action) => {
    if (!view || busy || end) return;
    if (timeout.current) clearTimeout(timeout.current);
    setBusy(true);
    try {
      const v = await play(action, action === 'stand' ? undefined : view.step);
      if (action === 'stand') { setView(v); finish(v.multiplier, false); return; }
      const prev = cardSrc(view.card, suit);
      setSuit(SUITS[Math.floor(Math.random() * 4)]);
      setDeal({ prev, ok: !!v.ok });
      setView({ ...v, card: v.next ?? v.card });
      try { navigator.vibrate?.(v.ok ? 15 : [80, 40, 80]); } catch { /* */ }
      await new Promise((r) => setTimeout(r, 750));
      setDeal(null);
      if (v.done) finish(v.multiplier, !!v.busted);
    } catch {
      done.current(view.multiplier);
    } finally {
      setBusy(false);
    }
  };

  if (!view) return <div className="hilo"><h2 className="hilo-title">Mayor o menor</h2></div>;
  const reached = end ? (end.busted ? -1 : view.step - 1) : view.step - 1;

  return (
    <div className={`hilo ${end?.busted ? 'busted' : ''}`}>
      <h2 className="hilo-title">Mayor o menor</h2>
      <ol className="ladder" aria-label="Multiplicadores">
        {view.ladder.map((m, i) => <li key={i} className={i <= reached ? 'on' : ''}>{fmtX(m)}</li>)}
      </ol>
      <div className="table">
        {deal && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="card prev" src={deal.prev} alt="" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={`${view.card}-${view.step}-${suit}`} className={`card ${deal ? (deal.ok ? 'in ok' : 'in bad') : ''}`}
          src={cardSrc(view.card, suit)} alt={NAMES[view.card] ?? String(view.card)} />
      </div>
      {end ? (
        <p className={`hilo-end ${end.busted ? 'bad' : ''}`}>{end.busted ? 'Perdiste el multiplicador' : view.step === 0 ? 'Pasaste' : `Te llevás ${fmtX(end.multiplier)}`}</p>
      ) : (
        <>
          <div className="thumbs">
            <button className="thumb-btn" disabled={busy} onClick={() => act.current('higher')} aria-label="Mayor">👍</button>
            <button className="thumb-btn" disabled={busy} onClick={() => act.current('lower')} aria-label="Menor">👎</button>
          </div>
          <button className="cta" disabled={busy} onClick={() => act.current('stand')}>
            {view.step === 0 ? 'Paso' : `Me planto con ${fmtX(view.multiplier)}`}
          </button>
        </>
      )}
    </div>
  );
}
