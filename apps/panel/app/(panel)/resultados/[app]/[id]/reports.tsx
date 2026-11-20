import Link from 'next/link';
import { Download, FileText } from 'lucide-react';
import { Card } from '@/components/ui/primitives';
import { KIND_LABEL, STATUS_LABEL, type ReportKind } from '@/lib/reports';
import { fmt } from '@/lib/utils';

/** Bajar resultados: el archivo para pasarle a Claude y la planilla de Excel (mismos filtros que la pantalla). */
export function ReportsPanel({ app, instrumentId, hasData, query, reports }: {
  app: string; instrumentId: string; hasData: boolean; query: string;
  reports: { id: string; kind: ReportKind; title: string; status: string; author: string; created_at: string }[];
}) {
  const base = `/resultados/${app}/${encodeURIComponent(instrumentId)}/bajar?${query}`;
  const btn = 'inline-flex h-9 items-center gap-1.5 rounded border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-sunken';
  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="font-medium">Bajar resultados</div>
          <div className="text-sm text-fg-3">
            El archivo para Claude trae cada pregunta con su resultado y los cortes por edad, género y zona: subilo al chat y pedile la lectura. El Excel tiene el resumen, los cortes, quiénes respondieron y una fila por respuesta.
          </div>
        </div>
        {hasData ? (
          <div className="flex flex-wrap gap-2">
            <a href={`${base}&formato=claude`} className={btn} download><Download className="size-4" /> Archivo para Claude</a>
            <a href={`${base}&formato=excel`} className={btn} download><Download className="size-4" /> Excel</a>
          </div>
        ) : <span className="text-sm text-fg-3">Todavía no hay respuestas.</span>}
      </div>
      {reports.length > 0 && (
        <ul className="border-t border-border">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 last:border-0">
              <Link href={`/informes/${r.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                <FileText className="size-4 shrink-0 text-fg-3" />
                <span className="truncate">{r.title}</span>
              </Link>
              <span className="shrink-0 text-xs text-fg-3">{KIND_LABEL[r.kind]} · {STATUS_LABEL[r.status] ?? r.status} · {fmt.ago(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
