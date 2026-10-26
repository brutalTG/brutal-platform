import { requireInternal, HttpError } from '@/lib/http';
import { questionImage } from '@/lib/amigos/images';

export const runtime = 'nodejs';

// Vista previa de la imagen de una pregunta mientras se escribe en el panel.
export async function POST(req: Request) {
  try { await requireInternal(req); } catch (e) { if (e instanceof HttpError) return new Response('No autorizado', { status: 401 }); throw e; }
  const b = await req.json().catch(() => ({})) as Record<string, string>;
  const cut = (v: unknown, n: number) => String(v ?? '').slice(0, n);
  return questionImage(
    { prompt: cut(b.prompt, 280) || 'Escribí el dilema…', detail: cut(b.detail, 200) || null, option_a: cut(b.option_a, 40) || 'Opción A', option_b: cut(b.option_b, 40) || 'Opción B' },
    cut(b.by, 80) || 'Pregunta de BRUTAL · TU GRUPO',
    b.teaser ? cut(b.teaser, 80) : null,
  );
}
