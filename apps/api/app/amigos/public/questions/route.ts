import { from } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Las cartas de la casa, para la webapp pública (versión imprimible y gratis, como CAH).
export async function GET() {
  const { data, error } = await from('amigos', 'questions').select('id, prompt, detail, option_a, option_b, tags')
    .eq('origin', 'house').eq('status', 'active').order('picked', { ascending: false }).limit(200);
  if (error) return Response.json({ ok: false, questions: [] }, { status: 500 });
  return Response.json({ ok: true, questions: data ?? [] }, { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } });
}
