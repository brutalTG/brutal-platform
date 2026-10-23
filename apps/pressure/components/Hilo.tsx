'use client';

import { useEffect, useRef, useState } from 'react';
import type { HiloView } from '@/lib/api';

const FACE: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const SUITS = ['♠', '♥', '♦', '♣'];
const face = (n: number) => FACE[n] ?? String(n);
const fmtX = (m: number) => `x${String(m).replace('.', ',')}`;

/**
 * Mayor o menor. La API reparte: el navegador nunca sabe la carta que viene.
 * Devuelve el multiplicador con el que se quedó (1 si perdió o no apostó).
 */
export function Hilo({ play, onDone }: { play: (action: 'start' | 'higher' | 'lower' | 'stand', step?: number) => Promise<HiloView>; onDone: (multiplier: number) => void }) {
  const [view, setView] = useState<HiloView | null>(null);
  const [busy, setBusy] = useState(false);
  const [flip, setFlip] = useState<{ from: number; to: number; ok: boolean } | null>(null);
  const [end, setEnd] = useState<{ multiplier: number; busted: boolean } | null>(null);
  const [suit, setSuit] = useState('♠');
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    play('start').then((v) => {
      setView(v);
      if (v.done) finish(v.multiplier, !!v.busted);
    }).catch(() => done.current(1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(multiplier: number, busted: boolean) {
    setEnd({ multiplier, busted });
    try { navigator.vibrate?.(busted ? [200] : [30, 40, 30, 40, 60]); } catch { /* */ }
    setTimeout(() => done.current(multiplier), busted ? 1800 : 1600);
  }

  async function act(action: 'higher' | 'lower' | 'stand') {
    if (!view || busy || end) return;
    setBusy(true);
    try {
      const v = await play(action, action === 'stand' ? undefined : view.step);
      if (action === 'stand') { setView(v); finish(v.multiplier, false); return; }
      setFlip({ from: view.card, to: v.next ?? v.card, ok: !!v.ok });
      setSuit(SUITS[Math.floor(Math.random() * 4)]);
      try { navigator.vibrate?.(v.ok ? 15 : [80, 40, 80]); } catch { /* */ }
      await new Promise((r) => setTimeout(r, 900));
      setFlip(null);
      setView({ ...v, card: v.next ?? v.card });
      if (v.done) finish(v.multiplier, !!v.busted);
    } catch {
      done.current(view.multiplier);
    } finally {
      setBusy(false);
    }
  }

  if (!view) return <div className="hilo"><p className="hilo-title">MAYOR O MENOR</p><p className="note">Mezclando…</p></div>;
  const red = suit === '♥' || suit === '♦';
  const shown = flip ? flip.to : view.card;

  return (
    <div className={`hilo ${end?.busted ? 'busted' : ''}`}>
      <p className="hilo-title">MAYOR O MENOR</p>
      <ol className="ladder" aria-label="Multiplicadores">
        {view.ladder.map((m, i) => (
          <li key={i} className={i < view.step ? 'won' : i === view.step && !end ? 'next' : ''}>{fmtX(m)}</li>
        ))}
      </ol>
      <div className="cards">
        {flip && <div className="card old"><b>{face(flip.from)}</b></div>}
        <div className={`card ${red ? 'red' : ''} ${flip ? (flip.ok ? 'in ok' : 'in bad') : ''}`} key={`${shown}-${view.step}-${flip ? 1 : 0}`}>
          <b>{face(shown)}</b><span>{suit}</span>
        </div>
      </div>
      {end ? (
        <p className={`hilo-end ${end.busted ? 'bad' : ''}`}>{end.busted ? 'PERDISTE EL MULTIPLICADOR' : `TE LLEVÁS ${fmtX(end.multiplier)}`}</p>
      ) : (
        <>
          <p className="hilo-now">{view.step === 0 ? '¿La que viene es mayor o menor?' : `Tenés ${fmtX(view.multiplier)}. ¿Seguís?`}</p>
          <div className="row">
            <button className="choice" disabled={busy} onClick={() => act('higher')}>Mayor</button>
            <button className="choice" disabled={busy} onClick={() => act('lower')}>Menor</button>
          </div>
          <button className="stand" disabled={busy} onClick={() => act('stand')}>
            {view.step === 0 ? 'Paso, no apuesto' : `Me planto con ${fmtX(view.multiplier)}`}
          </button>
          <p className="note">Empate cuenta como acierto. Si errás, volvés a x1.</p>
        </>
      )}
    </div>
  );
}
