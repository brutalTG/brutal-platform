'use server';

import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/db';
import { normalizePhone } from '@/lib/phone';

export type Audience =
  | { type: 'all' }
  | { type: 'filter'; minAge?: number | null; maxAge?: number | null; genders?: string[]; provinces?: string[]; minors?: 'include' | 'exclude' | 'only' }
  | { type: 'phones'; phones: string[] };

export type LaunchResult =
  | { ok: true; dryRun: boolean; audience: number; need_onboarding: number; minors: number; skipped: { opted_out: number; already_played: number; not_allowed: number }; truncated: boolean; mode: string; sent?: number; failed?: number }
  | { ok: false; error: string };

/** Pasa la lista de números a formato internacional; devuelve los que no se entienden. */
export async function parsePhones(raw: string) {
  const ok: string[] = [], bad: string[] = [];
  for (const t of raw.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean)) {
    const p = normalizePhone(t);
    if (p) ok.push(p); else bad.push(t);
  }
  return { ok: [...new Set(ok)], bad };
}

export async function launch(drop: string, audience: Audience, dryRun: boolean): Promise<LaunchResult> {
  const api = process.env.API_URL, secret = process.env.INTERNAL_API_SECRET;
  if (!api || !secret) return { ok: false, error: 'Falta configurar API_URL e INTERNAL_API_SECRET en el panel.' };
  try {
    const res = await fetch(`${api.replace(/\/+$/, '')}/internal/launch`, {
      method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop, audience, dry_run: dryRun }), cache: 'no-store', signal: AbortSignal.timeout(290_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.message ?? body.error ?? `El API respondió ${res.status}` };
    if (!body.ok) return { ok: false, error: body.error ?? 'No se pudo.' };
    if (!dryRun) {
      await audit('lanzó un experimento', 'drop', drop, { audience, sent: body.sent, failed: body.failed });
      revalidatePath('/mensajes');
      revalidatePath('/experimentos/lanzar');
    }
    return body;
  } catch {
    return { ok: false, error: 'No pude hablar con el API. ¿Está publicado?' };
  }
}
