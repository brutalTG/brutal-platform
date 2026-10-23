'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Polygraph, type PolygraphHandle } from '@/components/Polygraph';
import { Rich } from '@/components/Rich';
import { Rafaga } from '@/components/Rafaga';
import { Hilo } from '@/components/Hilo';
import { ApiError, client, intro as fetchIntro, start, type Finish, type Intro, type Game as GameDef, type GameItem, type Start, type Tap } from '@/lib/api';
import { Listener, Machine } from '@/lib/voice';

type Phase = 'entry' | 'loading' | 'consent' | 'play' | 'accuse' | 'result' | 'error';
type Step =
  | { mode: 'machine' }
  | { mode: 'listen'; lie?: { left: number; forced: boolean; banned: boolean } }
  | { mode: 'wait' }
  | { mode: 'rafaga' }
  | { mode: 'hilo' };
type Shown = GameItem & { media_url?: string | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shouldFollowUp = (when: string, stated: string | undefined) =>
  when === 'always' || (when === 'yes' ? ['yes', 'agree', 'a'].includes(stated ?? '') : ['no', 'disagree', 'b'].includes(stated ?? ''));

export function Game({ code }: { code: string }) {
  const poly = useRef<PolygraphHandle>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [panelH, setPanelH] = useState(300);
  const [phase, setPhase] = useState<Phase>('entry');
  const [error, setError] = useState<{ title: string; body: string; retry?: boolean } | null>(null);
  const [session, setSession] = useState<Start | null>(null);
  const [step, setStep] = useState<Step>({ mode: 'machine' });
  const [subtitle, setSubtitle] = useState('');
  const [hud, setHud] = useState({ label: 'CALIBRANDO', n: 0, total: 10, tickets: 0, liesLeft: 3, multiplier: 1 });
  const [current, setCurrent] = useState<Shown | null>(null);
  const [lieOn, setLieOn] = useState(false);
  const [result, setResult] = useState<Finish | null>(null);
  const [stamp, setStamp] = useState<'caught' | 'escaped' | null>(null);
  const [intro, setIntro] = useState<Intro | null>(null);

  // Los textos de entrada vienen del panel. Si el link no sirve, se avisa antes de tocar "Entrar".
  useEffect(() => {
    fetchIntro(code).then(setIntro).catch((e) => fail(e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const machine = useRef<Machine | null>(null);
  const ear = useRef<Listener | null>(null);
  const lieAt = useRef<number | null>(null);
  const overlay = useRef<((v: unknown) => void) | null>(null);
  const api = useRef<ReturnType<typeof client> | null>(null);
  const playing = useRef(false);

  // El polígrafo se acomoda arriba del panel de texto.
  useEffect(() => {
    if (!panel.current) return;
    const ro = new ResizeObserver(([e]) => setPanelH(Math.round(e.contentRect.height + 24)));
    ro.observe(panel.current);
    return () => ro.disconnect();
  }, [phase]);

  // Si cierra a mitad de partida, queda cortada (puede volver a empezar con el mismo link).
  useEffect(() => {
    const onHide = () => { if (playing.current) api.current?.abandon('pagehide'); };
    addEventListener('pagehide', onHide);
    return () => removeEventListener('pagehide', onHide);
  }, []);

  const fail = useCallback((e: unknown) => {
    playing.current = false;
    ear.current?.close();
    if (e instanceof ApiError) {
      const expired = ['expired_link', 'used_link', 'invalid_link', 'invalid_session'].includes(e.code);
      setError({ title: expired ? 'Este link ya no sirve' : 'Se cortó', body: e.message, retry: !expired });
    } else {
      setError({ title: 'Se cortó', body: 'Algo falló en la conexión. Volvé a entrar con el mismo link.', retry: true });
    }
    setPhase('error');
  }, []);

  async function enter() {
    poly.current?.jolt(1);
    setPhase('loading');
    try {
      const s = await start(code);
      setSession(s);
      api.current = client(s.token);
      machine.current = new Machine((t) => api.current!.tts(t));
      setHud((h) => ({ ...h, total: s.game.items.length, liesLeft: s.game.rules.lies }));
      setPhase('consent');
      // Precarga la voz mientras lee el consentimiento.
      const g = s.game;
      const first = [String(g.lines.intro), String(g.lines.calibration_start), ...g.calibration.map((c) => c.prompt)];
      machine.current.prefetch(first);
    } catch (e) {
      fail(e);
    }
  }

  async function begin() {
    if (!session || !machine.current) return;
    machine.current.unlock();
    try {
      ear.current = new Listener();
      await ear.current.open();
    } catch {
      setError({ title: 'Necesito tu micrófono', body: 'Sin micrófono la máquina no te escucha. Habilitalo en los permisos del navegador para este sitio y volvé a entrar.', retry: true });
      setPhase('error');
      return;
    }
    playing.current = true;
    setPhase('play');
    run(session).catch(fail);
  }

  // ---------- el guion ----------
  async function say(text: string) {
    setStep({ mode: 'machine' });
    setSubtitle(text);
    await machine.current!.say(text, (v) => poly.current?.setLevel(v * 0.5));
  }

  // Respuesta corta (sí/no): corta al segundo de silencio. Si está contando algo, espera más.
  async function hear(maxMs: number, endSilenceMs = 1000, lie?: { left: number; forced: boolean; banned: boolean }) {
    await ear.current!.resume();
    setStep({ mode: 'listen', lie });
    const r = await ear.current!.listen({ maxMs, noSpeechMs: 9000, endSilenceMs, onLevel: (v) => poly.current?.setLevel(v) });
    setStep({ mode: 'wait' });
    return r;
  }

  async function run(s: Start) {
    const g: GameDef = s.game;
    const lines = g.lines as Record<string, string>;
    const pending: Promise<unknown>[] = [];

    // Precarga del resto del guion en segundo plano.
    machine.current!.prefetch([
      lines.calibration_end, lines.game_start, lines.unclear, lines.unclear_choice ?? '', lines.not_heard ?? '',
      lines.rafaga_start ?? '', lines.hilo_start ?? '', lines.hilo_end ?? '', lines.vuelta_start ?? '',
      ...[...g.items, ...(g.stages?.vuelta ? g.vuelta : [])].flatMap((i) => [i.prompt, ...(i.follow_up ? [i.follow_up] : [])]),
    ].filter(Boolean));

    await say(lines.intro);
    await say(lines.calibration_start);

    // Calibración: verdad + una mentira obvia. Sirve de línea de base.
    for (const c of g.calibration) {
      setHud((h) => ({ ...h, label: c.kind === 'obvious_lie' ? 'MENTIRA DE CONTROL' : 'CALIBRANDO' }));
      await say(c.prompt);
      const calPause = c.answer_type === 'open' ? 1600 : 1000;
      let heard = await hear(15000, calPause);
      if (heard.silent && lines.not_heard) { await say(lines.not_heard); heard = await hear(15000, calPause); }
      pending.push(api.current!.answer({ item_id: c.id, stage: 'main', attempt: 1, features: feats(heard, null) }, heard.audio));
      if (c.kind === 'obvious_lie') poly.current?.jolt(0.9);
    }
    await say(lines.calibration_end);

    // Ráfaga al tacto: sin voz, sin mentiras. Lo primero que les sale.
    if (g.stages?.rafaga && g.rafaga.length > 0) {
      setHud((h) => ({ ...h, label: 'RÁFAGA' }));
      await say(lines.rafaga_start || 'Ráfaga. No pienses. Tocá.');
      const taps = await overlayStep<Tap[]>({ mode: 'rafaga' });
      pending.push(api.current!.taps(taps));
    }

    await say(lines.game_start);

    const voiced: Shown[] = [...g.items, ...(g.stages?.vuelta ? g.vuelta : [])];
    const hiloAfter = g.stages?.hilo ? Math.ceil(g.items.length / 2) : -1;
    let lies = 0, answered = 0, tickets = 0, multiplier = 1;

    for (let k = 0; k < voiced.length; k++) {
      const item = voiced[k];
      if (k === hiloAfter) {
        setHud((h) => ({ ...h, label: 'MAYOR O MENOR' }));
        setCurrent(null);
        await say(lines.hilo_start || 'Mayor o menor.');
        multiplier = await overlayStep<number>({ mode: 'hilo' });
        setHud((h) => ({ ...h, multiplier }));
        if (lines.hilo_end) await say(lines.hilo_end);
      }
      if (k === g.items.length && lines.vuelta_start) {
        setCurrent(null);
        setHud((h) => ({ ...h, label: 'LA VUELTA' }));
        await say(lines.vuelta_start);
      }
      const n = item.position;
      setHud((h) => ({ ...h, label: k >= g.items.length ? `VUELTA ${k - g.items.length + 1}` : `PREGUNTA ${n}`, n }));
      setCurrent(item);
      await say(item.prompt);

      // Un solo botón: MENTIR. Si no lo toca, es verdad. El presupuesto obliga al final.
      const left = g.rules.lies - lies, remaining = voiced.length - answered;
      const forced = left > 0 && left >= remaining, banned = left <= 0;
      lieAt.current = forced ? 0 : null;
      setLieOn(forced);
      const listenStarted = performance.now();
      const mainPause = item.answer_type === 'open' ? 1800 : item.answer_type === 'choice' ? 1400 : 1100;
      let heard = await hear(20000, mainPause, { left, forced, banned });
      if (heard.silent && lines.not_heard) { await say(lines.not_heard); heard = await hear(20000, mainPause, { left, forced, banned }); }
      const committed: 'truth' | 'lie' = lieAt.current !== null ? 'lie' : 'truth';
      const lieMs = lieAt.current && lieAt.current > 0 ? Math.round(lieAt.current - listenStarted) : null;
      lieAt.current = null;
      setLieOn(false);
      if (committed === 'lie') lies++;
      answered++;
      setHud((h) => ({ ...h, liesLeft: g.rules.lies - lies }));

      const first = api.current!.answer({ item_id: item.id, stage: 'main', attempt: 1, committed, features: { ...feats(heard, null), lie_press_ms: lieMs } }, heard.audio);
      pending.push(first);

      // Si tardó en arrancar o se frenó, el papel salta. Sin comentario: pasa directo a la siguiente.
      if ((heard.onset_ms ?? 0) > 1400 || heard.pauses > 1) poly.current?.jolt(0.55); else poly.current?.jolt(0.15);

      // Solo se espera la transcripción cuando la repregunta depende de lo que contestó.
      let ask = Boolean(item.follow_up);
      if (item.follow_up && item.follow_up_when !== 'always') {
        let r = await first.catch(() => null);
        if (r && r.parsed === 'unclear' && r.stt_ok && lines.unclear) {
          await say(item.answer_type === 'choice' ? (lines.unclear_choice || lines.unclear) : lines.unclear);
          const again = await hear(10000);
          const retry = api.current!.answer({ item_id: item.id, stage: 'main', attempt: 2, features: feats(again, null) }, again.audio);
          pending.push(retry);
          r = await retry.catch(() => null);
        }
        ask = shouldFollowUp(item.follow_up_when, r?.parsed);
      }
      if (ask && item.follow_up) {
        await say(item.follow_up);
        // La repregunta es donde cuentan: hasta 45 segundos y se banca pausas de casi 2 segundos.
        const f = await hear(45000, 1900);
        pending.push(api.current!.answer({ item_id: item.id, stage: 'follow', attempt: 1, features: feats(f, null) }, f.audio));
      }
      if (!s.replay) {
        tickets = Math.min(g.rewards.max, tickets + g.rewards.per_answer);
        setHud((h) => ({ ...h, tickets }));
      }
    }
    setCurrent(null);

    // Todas las respuestas tienen que estar guardadas antes de acusar.
    setStep({ mode: 'wait' });
    setSubtitle('Revisando el papel…');
    poly.current?.setSpeed(2.4);
    const settled = await Promise.allSettled(pending);
    const failed = settled.find((x) => x.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failed) throw failed.reason;

    const f = await api.current!.finish();
    playing.current = false;
    ear.current?.close();
    setResult(f);
    setPhase('accuse');
    machine.current!.prefetch([f.lines.accusation, f.lines.verdict]);
    poly.current?.setSpeed(1);
    poly.current?.jolt(0.9);
    await say(f.lines.accusation);
    poly.current?.setFrozen(true);
    setStamp(f.verdict);
    try { navigator.vibrate?.(f.verdict === 'caught' ? [200] : [40, 40, 40]); } catch { /* */ }
    await say(f.lines.verdict);
    await sleep(900);
    setPhase('result');
  }

  // Pantallas que tapan el polígrafo (ráfaga, mayor o menor): el guion espera a que terminen.
  function overlayStep<T>(st: Step): Promise<T> {
    return new Promise<T>((resolve) => {
      overlay.current = (v) => { overlay.current = null; resolve(v as T); };
      setStep(st);
    });
  }

  function markLie() {
    if (lieAt.current !== null) return;
    lieAt.current = performance.now();
    setLieOn(true);
    setHud((h) => ({ ...h, liesLeft: Math.max(0, h.liesLeft - 1) }));
    try { navigator.vibrate?.(25); } catch { /* */ }
  }

  function feats(h: { onset_ms: number | null; speech_ms: number; pauses: number; pitch_mean: number | null }, decisionMs: number | null) {
    return { decision_ms: decisionMs, onset_ms: h.onset_ms, speech_ms: h.speech_ms, pauses: h.pauses, pitch_mean: h.pitch_mean };
  }

  async function share() {
    if (!result) return;
    const text = result.verdict === 'escaped'
      ? `${result.lines.title}. Le mentí ${result.lies} veces a una máquina y no me agarró ninguna. ¿Vos podés? PRESSURE · BRUTAL`
      : `${result.lines.title}. Me agarró ${result.caught} de ${result.lies} mentiras. ¿Vos le podés mentir? PRESSURE · BRUTAL`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); setSubtitle('Copiado. Pegalo donde quieras.'); }
    } catch { /* canceló */ }
  }

  // ---------- pantallas ----------
  const g = session?.game;

  return (
    <main className="app">
      <Polygraph ref={poly} panelHeight={phase === 'result' ? 0 : panelH} />
      <div className="mark">Brutal<sup>™</sup></div>

      {(phase === 'play' || phase === 'accuse') && (
        <div className="hud" aria-live="off">
          <span>{session?.alias} · {hud.label}</span>
          <span className="hud-right">
            {!session?.replay && <b className="tix">{hud.tickets}{hud.multiplier > 1 && <em> x{String(hud.multiplier).replace('.', ',')}</em>} <small>tickets</small></b>}
            <span className="lies" aria-label={`Te quedan ${hud.liesLeft} mentiras`}>
              {Array.from({ length: g?.rules.lies ?? 3 }, (_, i) => <i key={i} className={i < hud.liesLeft ? 'on' : ''} />)}
            </span>
          </span>
        </div>
      )}

      {step.mode === 'rafaga' && g && <Rafaga items={g.rafaga} seconds={g.rafaga_seconds || 3} onDone={(t) => overlay.current?.(t)} />}
      {step.mode === 'hilo' && api.current && <Hilo play={(a, st) => api.current!.hilo(a, st)} onDone={(m) => overlay.current?.(m)} />}

      {stamp && phase !== 'result' && <div className={`stamp ${stamp === 'escaped' ? 'ok' : ''}`}>{stamp === 'escaped' ? 'ZAFASTE' : 'TE AGARRÓ'}</div>}

      {phase !== 'result' && (
        <div className="panel" ref={panel}>
          {phase === 'entry' && (
            <>
              <div className="copy">
                {intro ? intro.pitch.map((line, i) => <Rich key={i} text={line} />) : <p>Prendiendo la máquina…</p>}
              </div>
              <button className="enter" onClick={enter} disabled={!intro}>Entrar</button>
              {intro && <p className="note">{intro.screens.entry_note}</p>}
            </>
          )}

          {phase === 'loading' && <p className="copy">Prendiendo la máquina…</p>}

          {phase === 'consent' && (
            <>
              {session?.replay && <p className="banner">Ya cobraste tus tickets. Esta es una revancha: se juega igual, sin premio.</p>}
              <div className="copy small">
                {g && <Rich
                  text={session?.replay ? g.screens.consent.split(/\n\s*\n/).filter((p) => !p.includes('{max}') && !p.includes('{bonus}')).join('\n\n') : g.screens.consent}
                  vars={{ max: g.rewards.max, bonus: g.rewards.win_bonus }}
                />}
              </div>
              <button className="enter" onClick={begin}>Activar micrófono</button>
              {g && <p className="note">{g.screens.consent_note}</p>}
            </>
          )}

          {(phase === 'play' || phase === 'accuse') && (
            <>
              {current && step.mode !== 'machine' && phase === 'play' && (
                <>
                  {current.media_url && (/\.(mp4|webm|mov|m4v)($|\?)/i.test(current.media_url)
                    ? <video className="thumb" src={current.media_url} autoPlay muted playsInline loop />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img className="thumb" src={current.media_url} alt="" />)}
                  <p className={`question ${current.answer_type === 'choice' ? 'long' : ''}`}>{current.screen_text}</p>
                </>
              )}
              {!(current && step.mode !== 'machine' && phase === 'play') && <p className="subtitle" aria-live="polite">{subtitle}</p>}
              {step.mode === 'listen' && (
                <div className="decide">
                  {step.lie && !step.lie.banned && (
                    <button className={`choice lie big ${lieOn ? 'armed' : ''}`} disabled={lieOn} onClick={markLie}>
                      {lieOn ? (step.lie.forced ? 'Esta va mentira' : 'Vas a mentir') : `Mentir · quedan ${step.lie.left}`}
                    </button>
                  )}
                  {step.lie?.banned && <p className="hint">Sin mentiras. De acá al final, verdad.</p>}
                  <div className="listen">
                    <span className="rec" aria-hidden /> <span>Te escucho</span>
                    <button className="done" onClick={() => ear.current?.stop()}>Listo</button>
                  </div>
                </div>
              )}
              {step.mode === 'wait' && <div className="listen muted"><span className="dots" aria-hidden />Anotando</div>}
            </>
          )}

          {phase === 'error' && error && (
            <>
              <div className="copy small"><p><b>{error.title}</b></p><p>{error.body}</p></div>
              {error.retry && <button className="enter" onClick={() => location.reload()}>Volver a entrar</button>}
            </>
          )}
        </div>
      )}

      {phase === 'result' && result && g && (
        <section className={`result ${result.verdict === 'escaped' ? 'won' : 'lost'}`} aria-label="Resultado">
          <p className="kicker">PRESSURE · {session?.alias}</p>
          <h1 className="headline">{result.lines.title}</h1>
          <p className="sub">
            {result.verdict === 'escaped'
              ? `Le mentiste ${result.lies} veces a una máquina y no te agarró ninguna.`
              : `La máquina encontró ${result.caught} de tus ${result.lies} mentiras.`}
          </p>
          <ul className="lies-list" aria-label="Tus mentiras">
            {(result.lies_detail ?? result.your_lies.map((pos) => ({
              item_id: String(pos), text: g.items.find((i) => i.position === pos)?.screen_text ?? '', got: result.picks.some((p) => p.position === pos),
            }))).map((l) => (
              <li key={l.item_id} className={l.got ? 'got' : 'passed'}>
                <span>{l.text}</span>
                <b>{l.got ? 'Te agarró' : 'Zafaste'}</b>
              </li>
            ))}
          </ul>
          <div className="prize">
            {result.replay
              ? <span>Revancha: sin premio.</span>
              : <span><b>+{result.tickets.total}</b> Golden Tickets{(result.multiplier ?? 1) > 1 && <> · x{String(result.multiplier).replace('.', ',')}</>}</span>}
            {result.ranking.position && <span>#{result.ranking.position} de {result.ranking.players}</span>}
          </div>
          <div className="actions">
            <button onClick={share}>Compartir</button>
            <button className="primary" onClick={() => location.reload()}>Revancha</button>
          </div>
          <p className="note">El resultado también te llega por WhatsApp.</p>
        </section>
      )}
    </main>
  );
}
