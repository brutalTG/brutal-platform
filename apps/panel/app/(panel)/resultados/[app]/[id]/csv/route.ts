import { loadInstrument } from '@/lib/results-data';
import { toCsv } from '@/lib/results';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ app: string; id: string }> }) {
  const { app, id } = await ctx.params;
  const url = new URL(req.url);
  const { obs, facts, meta } = await loadInstrument(app, decodeURIComponent(id));
  const csv = toCsv(obs, facts, meta, { cut: 'none', includeArchived: url.searchParams.get('archivados') === '1' });
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="resultados-${app}-${id.replace(/[^a-z0-9-]/gi, '')}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
