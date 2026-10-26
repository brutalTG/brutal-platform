import { playLink } from '@/lib/site';

export const dynamic = 'force-dynamic';

// Un solo link para todas las placas: si el número del juego cambia, se cambia la variable y nada más.
export function GET(req: Request) {
  const text = new URL(req.url).searchParams.get('t');
  const link = playLink(text && text.length <= 80 ? text : undefined);
  if (!link) return new Response('El juego todavía no tiene número. Volvé en un rato.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return Response.redirect(link, 302);
}
