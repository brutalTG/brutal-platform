// ============================================================
// VOZ DE LA MÁQUINA — se baja una vez al empezar el Drop y queda en el teléfono.
// El servidor ya guarda cada frase después de generarla en ElevenLabs; acá además se
// pide todo al principio, así cuando llega la carta el audio sale al instante.
// ============================================================

import { API_BASE } from "./api-base";
import { userAuthHeaders } from "./access-context";

const cache = new Map<string, Promise<string | null>>();

function fetchUrl(text: string): Promise<string | null> {
  return fetch(`${API_BASE}/tts`, { method: "POST", headers: userAuthHeaders(), body: JSON.stringify({ text }) })
    .then((res) => (res.ok ? res.blob() : null))
    .then((b) => (b && b.size ? URL.createObjectURL(b) : null))
    .catch(() => null);
}

/** URL local del audio de esa frase. Si falla, se vuelve a intentar la próxima vez. */
export function voiceUrl(text: string): Promise<string | null> {
  let p = cache.get(text);
  if (!p) {
    p = fetchUrl(text).then((url) => { if (!url) cache.delete(text); return url; });
    cache.set(text, p);
  }
  return p;
}

/** Pide todas las frases del Drop de una vez. */
export function preloadVoices(texts: string[]) {
  for (const t of new Set(texts.filter(Boolean))) voiceUrl(t);
}

let playing: { el: HTMLAudioElement; done: () => void } | null = null;
let generation = 0;

/** Corta la voz si está hablando (cuando el jugador ya contesta o se va de la carta). */
export function stopSpeaking() {
  generation++;
  if (playing) { try { playing.el.pause(); } catch {} playing.done(); playing = null; }
  try { if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); } catch {}
}

/** Dice la frase y espera a que termine. Sin audio: la voz del teléfono; si tampoco hay, sigue. */
export async function say(text: string) {
  const mine = ++generation;
  const url = await voiceUrl(text);
  if (mine !== generation) return; // ya la cortaron mientras bajaba
  if (url) {
    const el = new Audio(url);
    const ok = await new Promise<boolean>((resolve) => {
      playing = { el, done: () => resolve(true) };
      el.onended = () => resolve(true);
      el.onerror = () => resolve(false);
      el.play().catch(() => resolve(false));
    });
    if (playing?.el === el) playing = null;
    if (ok || mine !== generation) return;
  }
  if (typeof speechSynthesis === "undefined" || mine !== generation) return;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "es-AR";
    const t = setTimeout(resolve, 2000 + text.length * 80);
    u.onend = () => { clearTimeout(t); resolve(); };
    u.onerror = () => { clearTimeout(t); resolve(); };
    speechSynthesis.speak(u);
  });
}
