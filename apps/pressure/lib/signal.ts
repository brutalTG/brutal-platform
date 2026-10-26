// Medición de la voz en el navegador. Funciones puras para poder probarlas.

export function rms(buf: Float32Array) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / buf.length);
}

// Tono por autocorrelación, entre 70 y 400 Hz (voz humana). Devuelve null si no hay voz clara.
export function pitch(buf: Float32Array, sampleRate: number): number | null {
  const n = buf.length;
  if (rms(buf) < 0.01) return null;
  const minLag = Math.floor(sampleRate / 400), maxLag = Math.min(Math.floor(sampleRate / 70), n - 1);
  let best = -1, bestLag = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i < n - lag; i++) c += buf[i] * buf[i + lag];
    if (c > best) { best = c; bestLag = lag; }
  }
  let energy = 0;
  for (let i = 0; i < n; i++) energy += buf[i] * buf[i];
  if (bestLag < 0 || best / energy < 0.3) return null;
  return sampleRate / bestLag;
}

/**
 * Detector de habla por energía. Se alimenta con un valor de volumen por cuadro.
 * Arranca cuando el volumen supera el umbral un rato; termina tras un silencio largo.
 */
export class Vad {
  onsetAt: number | null = null;
  lastVoiceAt: number | null = null;
  pauses = 0;
  private aboveSince: number | null = null;
  private inPause: number | null = null;
  private threshold: number;
  private opts: { onsetMs: number; pauseMs: number; endSilenceMs: number };
  constructor(threshold: number, opts = { onsetMs: 120, pauseMs: 400, endSilenceMs: 1000 }) {
    this.threshold = threshold;
    this.opts = opts;
  }

  feed(level: number, now: number): 'idle' | 'speaking' | 'ended' {
    const voiced = level > this.threshold;
    if (this.onsetAt === null) {
      if (voiced) {
        this.aboveSince ??= now;
        if (now - this.aboveSince >= this.opts.onsetMs) { this.onsetAt = this.aboveSince; this.lastVoiceAt = now; }
      } else this.aboveSince = null;
      return this.onsetAt === null ? 'idle' : 'speaking';
    }
    if (voiced) {
      if (this.inPause !== null && now - this.inPause >= this.opts.pauseMs) this.pauses++;
      this.inPause = null;
      this.lastVoiceAt = now;
      return 'speaking';
    }
    this.inPause ??= now;
    return now - (this.lastVoiceAt ?? now) >= this.opts.endSilenceMs ? 'ended' : 'speaking';
  }

  speechMs() {
    return this.onsetAt !== null && this.lastVoiceAt !== null ? Math.max(0, this.lastVoiceAt - this.onsetAt) : 0;
  }
}

// Umbral a partir del ruido de fondo medido antes de que hable.
export const thresholdFrom = (noiseFloor: number) => Math.max(0.015, Math.min(0.12, noiseFloor * 3 + 0.006));
