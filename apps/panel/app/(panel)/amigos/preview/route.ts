// Vista previa de la imagen de una pregunta (la dibuja el API). Protegida por la sesión del panel.
export async function GET(req: Request) {
  const api = process.env.API_URL, secret = process.env.INTERNAL_API_SECRET;
  if (!api || !secret) return new Response('Falta API_URL', { status: 503 });
  const q = new URL(req.url).searchParams;
  const res = await fetch(`${api.replace(/\/+$/, '')}/internal/amigos/preview`, {
    method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ prompt: q.get('prompt'), detail: q.get('detail'), option_a: q.get('a'), option_b: q.get('b'), by: q.get('by'), teaser: q.get('t') }),
  }).catch(() => null);
  if (!res || !res.ok) return new Response('No pude dibujar la imagen', { status: 502 });
  return new Response(res.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=60' } });
}
