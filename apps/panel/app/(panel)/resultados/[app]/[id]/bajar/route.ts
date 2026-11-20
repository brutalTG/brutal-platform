// Bajar resultados: ?formato=claude → JSON ordenado para subirle a Claude; ?formato=excel → planilla .xlsx.
import { loadInstrument } from '@/lib/results-data';
import { exportResults, excelSheets } from '@/lib/results-export';
import { xlsx } from '@/lib/xlsx';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request, ctx: { params: Promise<{ app: string; id: string }> }) {
  const { app, id: raw } = await ctx.params;
  const id = decodeURIComponent(raw);
  const url = new URL(req.url);
  const opt = { includeArchived: url.searchParams.get('archivados') === '1', includeTrapFailed: url.searchParams.get('trampas') === '1', includeLies: url.searchParams.get('mentiras') === '1' };
  const { obs, facts, meta, name, study } = await loadInstrument(app, id);
  const data = exportResults({ obs, facts, meta, name, app, id, study, opt });
  const day = new Date().toISOString().slice(0, 10);
  const file = `brutal-${id.replace(/[^a-z0-9-]/gi, '')}-${day}`;
  if (url.searchParams.get('formato') === 'excel') {
    const body = xlsx(excelSheets(data, { obs, facts, meta, opt }));
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${file}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
