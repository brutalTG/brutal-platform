// ============================================================
// PREGUNTA POR VOZ — se lee (o la dice la voz de BRUTAL) y se contesta hablando.
// El audio sube con la respuesta; el servidor lo transcribe y lo guarda en privado.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { DuotoneCard, CardTitle, ActionButton } from "./brutal-ui";
import { hapticMedium } from "./haptics";
import { API_BASE } from "./api-base";
import { userAuthHeaders } from "./access-context";

type Done = { audio: Blob | null; mime: string; speechMs: number; latencyMs: number };

function pickMime() {
  const options = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
  return options.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) ?? "";
}

async function say(text: string) {
  try {
    const res = await fetch(`${API_BASE}/tts`, { method: "POST", headers: userAuthHeaders(), body: JSON.stringify({ text }) });
    if (!res.ok) throw new Error(String(res.status));
    const url = URL.createObjectURL(await res.blob());
    const el = new Audio(url);
    await new Promise<void>((resolve) => { el.onended = () => resolve(); el.onerror = () => resolve(); el.play().catch(() => resolve()); });
    URL.revokeObjectURL(url);
  } catch {
    if (typeof speechSynthesis === "undefined") return;
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-AR";
      const t = setTimeout(resolve, 2000 + text.length * 80);
      u.onend = () => { clearTimeout(t); resolve(); };
      u.onerror = () => { clearTimeout(t); resolve(); };
      speechSynthesis.speak(u);
    });
  }
}

export function VoiceQuestion({ actionHint, text, speak = true, maxSeconds = 20, optionA, optionB, answerType, onDone }: {
  actionHint: string; text: string; speak?: boolean; maxSeconds?: number; optionA?: string; optionB?: string; answerType?: string;
  onDone: (d: Done) => void;
}) {
  const [phase, setPhase] = useState<"ready" | "speaking" | "recording" | "denied" | "sending">(speak ? "speaking" : "ready");
  const [level, setLevel] = useState(0);
  const [left, setLeft] = useState(maxSeconds);
  const shownAt = useRef(performance.now());
  const rec = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    let alive = true;
    if (speak) say(text).finally(() => { if (alive) { setPhase((p) => (p === "speaking" ? "ready" : p)); shownAt.current = performance.now(); } });
    return () => { alive = false; rec.current?.stop(); };
  }, [speak, text]);

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
      const remaining = Math.max(0, maxSeconds - (now - began) / 1000);
      setLeft(Math.ceil(remaining));
      if (remaining <= 0) return stop();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      setPhase("sending");
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
        const audio = chunks.length ? new Blob(chunks, { type: mr.mimeType || mime || "audio/webm" }) : null;
        onDone({ audio, mime: mr.mimeType || mime, speechMs: Math.round(speechMs), latencyMs });
      };
      mr.stop();
    };
    rec.current = { stop };
    mr.start(250);
    setPhase("recording");
    raf = requestAnimationFrame(tick);
  }

  const options = answerType === "choice" && optionA && optionB ? [optionA, optionB] : null;

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
            <ActionButton label="Seguir" onClick={() => onDone({ audio: null, mime: "", speechMs: 0, latencyMs: Math.round(performance.now() - shownAt.current) })} />
          </div>
        )}
      </DuotoneCard>
      <p className="text-center font-['Fira_Code'] text-[11px] opacity-60">Tu respuesta queda grabada.</p>
    </div>
  );
}
