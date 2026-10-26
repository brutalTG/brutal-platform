import { from } from '@/lib/db';
import { verifyImage } from '@/lib/amigos/server';
import { labelImage, questionImage, revealImage, tableImage } from '@/lib/amigos/images';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Params = { params: Promise<{ kind: string; id: string }> };

// Imágenes del juego. Solo con firma: así nadie arma una imagen con texto propio usando la marca.
export async function GET(req: Request, ctx: Params) {
  const { kind, id: raw } = await ctx.params;
  const id = raw.replace(/\.png$/, '');
  const params = await verifyImage(kind, id, new URL(req.url).searchParams);
  if (!params || !/^[0-9a-f-]{36}$/.test(id)) return new Response('Firma inválida', { status: 403 });

  if (kind === 'q') {
    const { data: q } = await from('amigos', 'questions').select('prompt, detail, option_a, option_b').eq('id', id).maybeSingle();
    if (!q) return new Response('No existe', { status: 404 });
    return questionImage(q as any, params.by ?? 'AMIGOS DE MIERDA', params.t ?? null);
  }
  if (kind === 'r') {
    const { data: r } = await from('amigos', 'rounds').select('group_id, day, question_id, summary').eq('id', id).maybeSingle();
    if (!r) return new Response('No existe', { status: 404 });
    const [{ data: g }, { data: q }] = await Promise.all([
      from('amigos', 'groups').select('name, number').eq('id', (r as any).group_id).single(),
      from('amigos', 'questions').select('prompt, option_a, option_b').eq('id', (r as any).question_id).single(),
    ]);
    return revealImage({ group: (g as any).name, number: (g as any).number, day: (r as any).day, prompt: (q as any).prompt, option_a: (q as any).option_a, option_b: (q as any).option_b, summary: (r as any).summary ?? {} });
  }
  if (kind === 't') {
    const { data: g } = await from('amigos', 'groups').select('name, season').eq('id', id).maybeSingle();
    if (!g) return new Response('No existe', { status: 404 });
    const season = Number(params.s2 ?? (g as any).season);
    const { data: rows } = await from('amigos', 'standings').select('roster_name, points, position').eq('group_id', id).eq('season', season);
    const list = ((rows ?? []) as any[]).sort((a, b) => b.points - a.points || a.position - b.position).map((x) => ({ name: x.roster_name, points: x.points }));
    return tableImage({ group: (g as any).name, season, rows: list });
  }
  if (kind === 'e') {
    const [{ data: m }, { data: g }] = await Promise.all([
      from('amigos', 'members').select('roster_name').eq('id', id).maybeSingle(),
      from('amigos', 'groups').select('name, season').eq('id', params.g ?? '').maybeSingle(),
    ]);
    if (!m || !g) return new Response('No existe', { status: 404 });
    return labelImage({ group: (g as any).name, season: (g as any).season, name: (m as any).roster_name, label: params.l ?? '', stat: params.st ?? '' });
  }
  return new Response('Tipo desconocido', { status: 404 });
}
