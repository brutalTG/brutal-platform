// ============================================================
// PREGUNTA POR VOZ — se lee (o la dice la voz de BRUTAL) y se contesta hablando.
// El audio sube con la respuesta; el servidor lo transcribe y lo guarda en privado.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { DuotoneCard, CardTitle, ActionButton } from "./brutal-ui";
import { hapticMedium } from "./haptics";
import { say } from "./voice-cache";
import { Polygraph, type PolygraphHandle } from "./polygraph";

type Done = { audio: Blob | null; mime: string; speechMs: number; latencyMs: number; committed?: "truth" | "lie"; decisionMs?: number };

/** Carta de la máquina: qué puede marcar el jugador en esta carta. */
export type DetectorBudget = { mustLie: boolean; mustTell: boolean; remainingLies: number; remainingItems: number };

function pickMime() {
  const options = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) ?? "";
}

export function VoiceQuestion({ actionHint, text, speak = true, maxSeconds = 20, optionA, optionB, answerType, detector, budget, onDone }: {
  actionHint: string; text: string; speak?: boolean; maxSeconds?: number; optionA?: string; optionB?: string; answerType?: string;
  /** Carta de la máquina: antes de hablar marca en secreto verdad o mentira. */
  detector?: boolean; budget?: DetectorBudget;
  onDone: (d: Done) => void;
}) {
  // Carta de la máquina: después de escuchar, primero decide ("commit") y recién entonces aparece el micrófono.
  const [phase, setPhase] = useState<"ready" | "speaking" | "commit" | "recording" | "denied" | "sending">(speak ? "speaking" : detector ? "commit" : "ready");
  const [level, setLevel] = useState(0);
  const [left, setLeft] = useState(maxSeconds);
  const shownAt = useRef(performance.now());
  const rec = useRef<{ stop: () => void } | null>(null);
  const committed = useRef<{ value: "truth" | "lie"; decisionMs: number } | null>(null);
  const poly = useRef<PolygraphHandle>(null);

  useEffect(() => {
    let alive = true;
    if (speak) say(text).finally(() => { if (alive) { setPhase((p) => (p === "speaking" ? (detector ? "commit" : "ready") : p)); shownAt.current = performance.now(); } });
    return () => { alive = false; rec.current?.stop(); };
  }, [speak, text, detector]);

  function commit(value: "truth" | "lie") {
    hapticMedium();
    committed.current = { value, decisionMs: Math.round(performance.now() - shownAt.current) };
    poly.current?.jolt(value === "lie" ? 0.7 : 0.25);
    setPhase("ready");
  }

  const finish = (d: Omit<Done, "committed" | "decisionMs">) =>
    onDone(committed.current ? { ...d, committed: committed.current.value, decisionMs: committed.current.decisionMs } : d);

  async function start() {
    hapticMedium();
    const latencyMs = Math.round(performance.now() - shownAt.current);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      setPhase("denied");
      return;
    }
    const mime = pickMime();
    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    const an = ctx.createAnalyser();
    an.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    const began = performance.now();
    let speechMs = 0, last = began, raf = 0, finished = false;
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (rms > 0.02) speechMs += now - last;
      last = now;
      setLevel(Math.min(1, rms * 8));
      poly.current?.setLevel(Math.min(1, rms * 8));
      const remaining = Math.max(0, maxSeconds - (now - began) / 1000);
      setLeft(Math.ceil(remaining));
      if (remaining <= 0) return stop();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      poly.current?.setLevel(0);
      setPhase("sending");
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
        const audio = chunks.length ? new Blob(chunks, { type: mr.mimeType || mime || "audio/webm" }) : null;
        finish({ audio, mime: mr.mimeType || mime, speechMs: Math.round(speechMs), latencyMs });
      };
      mr.stop();
    };
    rec.current = { stop };
    mr.start(250);
    setPhase("recording");
    raf = requestAnimationFrame(tick);
  }

  const options = answerType === "choice" && optionA && optionB ? [optionA, optionB] : null;

  if (detector) {
    // Carta de la máquina: pantalla completa, el polígrafo arriba (mitad de la pantalla) y la pregunta abajo.
    const ink = "#F2F2F2";
    return (
      <div className="fixed inset-0 flex justify-center overflow-hidden bg-[#050505] font-['Roboto']" style={{ color: ink }}>
        <div className="flex h-dvh w-full max-w-[420px] flex-col">
          <div className="relative w-full shrink-0" style={{ height: "50dvh" }}>
            <Polygraph ref={poly} fill={0.98} label="La máquina te está midiendo" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16" style={{ background: "linear-gradient(to bottom, rgba(5,5,5,0), #050505)" }} />
            <p className="pointer-events-none absolute inset-x-0 font-['Silkscreen'] text-[13px] tracking-wide" style={{ top: "calc(var(--tg-safe-top, 0px) + 16px)", left: 20, textShadow: "0 1px 8px rgba(0,0,0,.8)" }}>
              BRUTAL////////////////
            </p>
          </div>

          <div className="flex flex-1 flex-col items-center px-6 pt-3 text-center" style={{ paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 20px)" }}>
            <h2 className="text-[24px] font-bold leading-tight">{text}</h2>
            <div className="flex-1" />

            {phase === "speaking" && <p className="font-['Fira_Code'] text-sm opacity-60">La máquina pregunta…</p>}

            {phase === "commit" && (
              <div className="flex w-full flex-col items-center gap-3">
                <p className="font-['Fira_Code'] text-xs uppercase tracking-[0.2em] opacity-70">
                  {budget?.mustLie ? "Te queda una mentira. Es esta." : budget?.mustTell ? "Ya mentiste todo. Esta va con la verdad." : "Antes de hablar, decidí en secreto"}
                </p>
                <div className="flex w-full gap-2">
                  {!budget?.mustLie && (
                    <button onClick={() => commit("truth")} className="h-[56px] flex-1 rounded-2xl text-base font-bold uppercase active:scale-95" style={{ backgroundColor: ink, color: "#050505" }}>Verdad</button>
                  )}
                  {!budget?.mustTell && (
                    <button onClick={() => commit("lie")} className="h-[56px] flex-1 rounded-2xl text-base font-bold uppercase active:scale-95" style={{ backgroundColor: "#FF0040", color: "#fff" }}>Mentira</button>
                  )}
                </div>
                {!budget?.mustLie && !budget?.mustTell && budget && (
                  <p className="font-['Fira_Code'] text-[11px] opacity-60">
                    {budget.remainingLies === 1 ? "Te queda 1 mentira" : `Te quedan ${budget.remainingLies} mentiras`} en {budget.remainingItems} preguntas.
                  </p>
                )}
              </div>
            )}

            {phase === "ready" && (
              <>
                <button onClick={start} className="mb-2 flex size-20 items-center justify-center rounded-full active:scale-95" style={{ backgroundColor: ink, color: "#050505" }} aria-label="Tocá y hablá">
                  <Mic size={34} />
                </button>
                <p className="font-['Fira_Code'] text-sm">Tocá y hablá</p>
              </>
            )}

            {phase === "recording" && (
              <>
                <button onClick={() => rec.current?.stop()} className="mb-2 flex size-20 items-center justify-center rounded-full" style={{ backgroundColor: ink, color: "#050505", boxShadow: `0 0 0 ${6 + level * 22}px rgba(242,242,242,.18)`, transition: "box-shadow 80ms linear" }} aria-label="Listo">
                  <Square size={28} fill="currentColor" />
                </button>
                <p className="font-['Fira_Code'] text-sm">Te escucho · {left}s · tocá para terminar</p>
              </>
            )}

            {phase === "sending" && <p className="font-['Fira_Code'] text-sm">Listo.</p>}

            {phase === "denied" && (
              <div className="flex w-full flex-col items-center gap-3">
                <p className="text-sm">No pudimos usar el micrófono. Habilitalo en el navegador o seguí sin responder esta.</p>
                <button onClick={() => finish({ audio: null, mime: "", speechMs: 0, latencyMs: Math.round(performance.now() - shownAt.current) })} className="h-[52px] w-full rounded-full font-bold" style={{ backgroundColor: ink, color: "#050505" }}>Seguir</button>
              </div>
            )}

            <p className="mt-4 font-['Fira_Code'] text-[11px] opacity-50">La máquina escucha. Nadie más.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 gap-6">
      <DuotoneCard hint={actionHint}>
        <CardTitle>{text}</CardTitle>
        {options && (
          <div className="mb-5 flex w-full gap-2">
            {options.map((o) => (
              <div key={o} className="flex-1 rounded-2xl px-3 py-3 text-center font-['Roboto'] text-base font-bold" style={{ border: "2px solid var(--dynamic-bg, #000)", color: "var(--dynamic-bg, #000)" }}>{o}</div>
            ))}
          </div>
        )}

        {phase === "speaking" && <p className="mb-4 font-['Fira_Code'] text-sm" style={{ color: "var(--dynamic-bg, #000)", opacity: 0.6 }}>Escuchá…</p>}

        {phase === "commit" && (
          <div className="flex w-full flex-col items-center gap-3">
            <p className="font-['Fira_Code'] text-xs uppercase tracking-[0.2em]" style={{ color: "var(--dynamic-bg, #000)", opacity: 0.7 }}>
              {budget?.mustLie ? "Te queda la mentira. Es esta." : budget?.mustTell ? "Ya mentiste. Esta va con la verdad." : "Antes de hablar, decidí en secreto"}
            </p>
            <div className="flex w-full gap-2">
              {!budget?.mustLie && (
                <button onClick={() => commit("truth")} className="flex-1 rounded-2xl px-3 py-4 font-['Roboto'] text-base font-bold uppercase active:scale-95"
                  style={{ backgroundColor: "var(--dynamic-bg, #000)", color: "var(--dynamic-fg, #fff)" }}>Verdad</button>
              )}
              {!budget?.mustTell && (
                <button onClick={() => commit("lie")} className="flex-1 rounded-2xl px-3 py-4 font-['Roboto'] text-base font-bold uppercase active:scale-95"
                  style={{ border: "2px solid var(--dynamic-bg, #000)", color: "var(--dynamic-bg, #000)" }}>Mentira</button>
              )}
            </div>
            {!budget?.mustLie && !budget?.mustTell && budget && (
              <p className="font-['Fira_Code'] text-[11px]" style={{ color: "var(--dynamic-bg, #000)", opacity: 0.6 }}>
                {budget.remainingLies === 1 ? "Te queda 1 mentira" : `Te quedan ${budget.remainingLies} mentiras`} en {budget.remainingItems} cartas.
              </p>
            )}
          </div>
        )}

        {phase === "ready" && (
          <button onClick={start} className="mb-2 flex size-24 items-center justify-center rounded-full active:scale-95" style={{ backgroundColor: "var(--dynamic-bg, #000)", color: "var(--dynamic-fg, #fff)" }} aria-label="Tocá y hablá">
            <Mic size={40} />
          </button>
        )}
        {phase === "ready" && <p className="font-['Fira_Code'] text-sm" style={{ color: "var(--dynamic-bg, #000)" }}>Tocá y hablá</p>}

        {phase === "recording" && (
          <>
            <button onClick={() => rec.current?.stop()} className="mb-2 flex size-24 items-center justify-center rounded-full" style={{ backgroundColor: "var(--dynamic-bg, #000)", color: "var(--dynamic-fg, #fff)", boxShadow: `0 0 0 ${8 + level * 26}px color-mix(in srgb, var(--dynamic-bg, #000) 22%, transparent)`, transition: "box-shadow 80ms linear" }} aria-label="Listo">
              <Square size={32} fill="currentColor" />
            </button>
            <p className="font-['Fira_Code'] text-sm" style={{ color: "var(--dynamic-bg, #000)" }}>Te escucho · {left}s · tocá para terminar</p>
          </>
        )}

        {phase === "sending" && <p className="font-['Fira_Code'] text-sm" style={{ color: "var(--dynamic-bg, #000)" }}>Listo.</p>}

        {phase === "denied" && (
          <div className="flex w-full flex-col items-center gap-3">
            <p className="text-center font-['Roboto'] text-sm" style={{ color: "var(--dynamic-bg, #000)" }}>No pudimos usar el micrófono. Habilitalo en el navegador o seguí sin responder esta.</p>
            <ActionButton label="Seguir" onClick={() => finish({ audio: null, mime: "", speechMs: 0, latencyMs: Math.round(performance.now() - shownAt.current) })} />
          </div>
        )}
      </DuotoneCard>
      <p className="text-center font-['Fira_Code'] text-[11px] opacity-60">{detector ? "La máquina escucha. Nadie más." : "Tu respuesta queda grabada."}</p>
    </div>
  );
}
