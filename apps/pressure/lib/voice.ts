'use client';

import { pitch, rms, thresholdFrom, Vad } from './signal';

// ---------- La voz de la máquina ----------

// Un WAV mudo de 50 ms, armado acá para no depender de un archivo.
function silentWav() {
  const rate = 8000, n = 400, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

export class Machine {
  private el: HTMLAudioElement;
  private cache = new Map<string, Promise<string | null>>();
  private broken = false;

  constructor(private fetchAudio: (text: string) => Promise<Blob>) {
    this.el = new Audio();
    this.el.preload = 'auto';
  }

  // iOS solo deja sonar audio si el primer play ocurre dentro de un toque del usuario.
  unlock() {
    this.el.src = silentWav();
    this.el.play().catch(() => {});
  }

  prefetch(texts: string[]) {
    // De a tres a la vez, en orden, para que lo primero esté listo primero.
    const queue = [...new Set(texts)];
    const worker = async () => { while (queue.length) await this.url(queue.shift()!); };
    return Promise.all([worker(), worker(), worker()]);
  }

  private url(text: string) {
    if (!this.cache.has(text)) {
      this.cache.set(text, this.fetchAudio(text).then((b) => URL.createObjectURL(b)).catch(() => null));
    }
    return this.cache.get(text)!;
  }

  /** Dice la frase. Si la voz falla, la dice el navegador; si tampoco, espera lo que tardaría en leerse. */
  async say(text: string, onLevel?: (v: number) => void): Promise<void> {
    const src = this.broken ? null : await this.url(text);
    if (src) {
      this.el.src = src;
      const ok = await new Promise<boolean>((resolve) => {
        let pulse = 0;
        const iv = onLevel ? setInterval(() => onLevel(0.25 + 0.25 * Math.abs(Math.sin((pulse += 0.7)))), 90) : null;
        const done = (v: boolean) => { if (iv) clearInterval(iv); onLevel?.(0); resolve(v); };
        this.el.onended = () => done(true);
        this.el.onerror = () => done(false);
        this.el.play().catch(() => done(false));
      });
      if (ok) return;
    }
    if (typeof speechSynthesis !== 'undefined') {
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'es-AR'; u.rate = 1.02; u.pitch = 0.7;
        const t = setTimeout(resolve, 2000 + text.length * 80);
        u.onend = () => { clearTimeout(t); resolve(); };
        u.onerror = () => { clearTimeout(t); resolve(); };
        speechSynthesis.speak(u);
      });
      return;
    }
    await new Promise((r) => setTimeout(r, 900 + text.length * 55));
  }

  markBroken() { this.broken = true; }
}

// ---------- El oído ----------

export type Heard = {
  audio: Blob | null;
  mime: string;
  onset_ms: number | null;
  speech_ms: number;
  pauses: number;
  pitch_mean: number | null;
  silent: boolean;
};

function pickMime() {
  const options = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) ?? '';
}

export class Listener {
  private ctx!: AudioContext;
  private analyser!: AnalyserNode;
  private stream!: MediaStream;
  private noise = 0.01;
  private cancelFn: (() => void) | null = null;

  async open() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctx();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    src.connect(this.analyser);
    await this.measureNoise(600);
  }

  private async measureNoise(ms: number) {
    const buf = new Float32Array(this.analyser.fftSize);
    const samples: number[] = [];
    const end = performance.now() + ms;
    while (performance.now() < end) {
      this.analyser.getFloatTimeDomainData(buf);
      samples.push(rms(buf));
      await new Promise((r) => setTimeout(r, 30));
    }
    samples.sort((a, b) => a - b);
    this.noise = samples[Math.floor(samples.length * 0.6)] ?? 0.01;
  }

  async resume() { if (this.ctx?.state === 'suspended') await this.ctx.resume(); }

  /** Escucha una respuesta: espera que hable, mide y corta tras un silencio. */
  listen(opts: { maxMs: number; noSpeechMs: number; onLevel?: (v: number) => void }): Promise<Heard> {
    return new Promise((resolve) => {
      const mime = pickMime();
      const chunks: Blob[] = [];
      let rec: MediaRecorder | null = null;
      try {
        rec = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.start(250);
      } catch { rec = null; }

      const vad = new Vad(thresholdFrom(this.noise));
      const start = performance.now();
      const buf = new Float32Array(this.analyser.fftSize);
      const pitches: number[] = [];
      let raf = 0, frames = 0, finished = false;

      const finish = (silent: boolean) => {
        if (finished) return;
        finished = true;
        cancelAnimationFrame(raf);
        this.cancelFn = null;
        opts.onLevel?.(0);
        const out = (audio: Blob | null) => resolve({
          audio, mime: rec?.mimeType || mime,
          onset_ms: vad.onsetAt !== null ? Math.round(vad.onsetAt - start) : null,
          speech_ms: Math.round(vad.speechMs()), pauses: vad.pauses,
          pitch_mean: pitches.length >= 3 ? Math.round(pitches.reduce((a, b) => a + b, 0) / pitches.length) : null,
          silent,
        });
        if (!rec || rec.state === 'inactive') return out(null);
        rec.onstop = () => out(chunks.length ? new Blob(chunks, { type: rec!.mimeType || mime || 'audio/webm' }) : null);
        rec.stop();
      };
      this.cancelFn = () => finish(vad.onsetAt === null);

      const loop = () => {
        const now = performance.now();
        this.analyser.getFloatTimeDomainData(buf);
        const level = rms(buf);
        opts.onLevel?.(Math.min(1, level * 6));
        const state = vad.feed(level, now);
        if (state === 'speaking' && ++frames % 6 === 0) {
          const p = pitch(buf, this.ctx.sampleRate);
          if (p) pitches.push(p);
        }
        if (state === 'ended') return finish(false);
        if (vad.onsetAt === null && now - start > opts.noSpeechMs) return finish(true);
        if (now - start > opts.maxMs) return finish(vad.onsetAt === null);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
  }

  /** El jugador tocó "Listo": corta ya. */
  stop() { this.cancelFn?.(); }

  close() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
  }
}
