import { handle, json, requireInternal, HttpError } from '@/lib/http';
import { amigosCtx } from '@/lib/amigos/server';
import { forceNextDay, openRound, reveal, tick, finishSeason } from '@/lib/amigos/engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Botones del panel para operar el juego: correr el reloj, abrir o revelar ya, arrancar el día siguiente.
export const POST = handle(async (req) => {
  await requireInternal(req);
  const b = await req.json().catch(() => ({})) as { action?: string; group_id?: string; round_id?: string };
  const ctx = amigosCtx();
  const s = ctx.store;
  if (b.action === 'tick') return json(req, { ok: true, did: await tick(ctx) });
  const g = b.group_id ? await s.group(b.group_id) : null;
  if (!g) throw new HttpError(404, 'no_group', 'No encuentro el grupo.');
  if (b.action === 'next_day') {
    const err = await forceNextDay(ctx, g);
    return json(req, err ? { ok: false, error: err } : { ok: true });
  }
  if (b.action === 'pause' || b.action === 'resume') {
    await s.updateGroup(g.id, { status: b.action === 'pause' ? 'paused' : 'active' });
    return json(req, { ok: true });
  }
  if (b.action === 'finish') { await finishSeason(ctx, g); return json(req, { ok: true }); }
  const r = b.round_id ? await s.round(b.round_id) : null;
  if (!r || r.group_id !== g.id) throw new HttpError(404, 'no_round', 'No encuentro la ronda.');
  if (b.action === 'open') {
    if (r.status !== 'drafting') return json(req, { ok: false, error: 'La ronda no está esperando abrirse.' });
    await openRound(ctx, g, r);
    return json(req, { ok: true });
  }
  if (b.action === 'reveal') {
    if (r.status !== 'open') return json(req, { ok: false, error: 'La ronda no está abierta.' });
    if ((await s.answers(r.id)).length < 1) return json(req, { ok: false, error: 'Nadie contestó todavía.' });
    await reveal(ctx, g, r);
    return json(req, { ok: true });
  }
  throw new HttpError(400, 'bad_action');
});
