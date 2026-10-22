'use client';

const API = (process.env.NEXT_PUBLIC_API_URL ?? 'https://test-api.brutal.lat').replace(/\/+$/, '');

export type GameItem = { id: string; position: number; kind: string; prompt: string; screen_text: string; answer_type: 'yes_no' | 'agree' | 'number' | 'open'; follow_up: string | null; follow_up_when: 'always' | 'yes' | 'no' };
export type Game = {
  name: string;
  pitch: string[];
  rules: { lies: number; win_max_caught: number };
  rewards: { per_answer: number; max: number; win_bonus: number };
  lines: Record<string, string | string[]>;
  calibration: GameItem[];
  items: GameItem[];
};
export type Start = { token: string; session_id: string; alias: string; replay: boolean; game: Game };
export type Finish = {
  verdict: 'caught' | 'escaped'; caught: number; lies: number;
  picks: { item_id: string; position: number; claim: string; reason: string }[];
  your_lies: number[];
  tickets: { progress: number; win: number; total: number };
  replay: boolean;
  ranking: { position: number | null; players: number | null };
  lines: { accusation: string; verdict: string; title: string };
};

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  const body = await res.json().catch(() => ({}));
  throw new ApiError(body.error ?? 'error', body.message ?? 'Algo falló. Probá de nuevo.', res.status);
}

export async function start(code: string): Promise<Start> {
  const device = { ua: navigator.userAgent.slice(0, 120), w: String(screen.width), h: String(screen.height), lang: navigator.language };
  return parse(await fetch(`${API}/pressure/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, device }) }));
}

export function client(token: string) {
  const auth = { Authorization: `Bearer ${token}` };
  return {
    async tts(text: string): Promise<Blob> {
      const res = await fetch(`${API}/pressure/tts`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!res.ok) throw new ApiError('tts', 'voz', res.status);
      return res.blob();
    },
    async answer(meta: Record<string, unknown>, audio: Blob | null): Promise<{ transcript: string; parsed: string; committed: string; stt_ok: boolean }> {
      const form = new FormData();
      form.append('meta', JSON.stringify(meta));
      if (audio) form.append('audio', audio, 'answer');
      // Hasta tres intentos: en el celular la red se corta.
      let last: unknown;
      for (let i = 0; i < 3; i++) {
        try {
          return await parse(await fetch(`${API}/pressure/answer`, { method: 'POST', headers: auth, body: form }));
        } catch (e) {
          last = e;
          if (e instanceof ApiError && e.status < 500) throw e;
          await new Promise((r) => setTimeout(r, 700 * (i + 1)));
        }
      }
      throw last;
    },
    async finish(): Promise<Finish> {
      let last: unknown;
      for (let i = 0; i < 3; i++) {
        try {
          return await parse(await fetch(`${API}/pressure/finish`, { method: 'POST', headers: auth }));
        } catch (e) {
          last = e;
          if (e instanceof ApiError && e.status < 500) throw e;
          await new Promise((r) => setTimeout(r, 900 * (i + 1)));
        }
      }
      throw last;
    },
    abandon(reason: string) {
      fetch(`${API}/pressure/abandon`, { method: 'POST', keepalive: true, headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }).catch(() => {});
    },
  };
}
