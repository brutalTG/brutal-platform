import { FileText } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { KIND_LABEL, STATUS_LABEL, type ReportKind } from '@/lib/reports';
import { Badge, Card, EmptyState, ErrorNotice, PageHeader, RowLink, Table, TD, TH, THead, TR } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Informes' };

export default async function ReportsPage() {
  const [{ data, error }, { data: studies }] = await Promise.all([
    from('signal', 'reports').select('id, kind, title, status, author, study_id, app_slug, instrument_id, updated_at').neq('status', 'archived').order('updated_at', { ascending: false }).limit(200),
    from('signal', 'studies').select('id, name'),
  ]);
  const sn = new Map((studies ?? []).map((s: any) => [s.id, s.name]));
  return (
    <>
      <PageHeader title="Informes" description="Hallazgos, Black Briefs y piezas. Los arma la IA desde Resultados y los terminás acá." />
      {error ? <ErrorNotice message={explain(error)!} /> : (
        <Card>
          {(data ?? []).length === 0 ? <EmptyState icon={<FileText />} title="Todavía no hay informes" description="Entrá a Resultados, elegí un experimento y tocá «Leer resultados»." /> : (
            <Table>
              <THead><tr><TH>Informe</TH><TH>Tipo</TH><TH>Estudio</TH><TH>Estado</TH><TH>Actualizado</TH></tr></THead>
              <tbody>
                {(data ?? []).map((r: any) => (
                  <TR key={r.id}>
                    <TD><RowLink href={`/informes/${r.id}`}>{r.title}</RowLink><div className="text-xs text-fg-3">{r.author === 'claude' ? 'Borrador de la IA' : 'Escrito en el panel'}{r.instrument_id ? ` · ${r.instrument_id}` : ''}</div></TD>
                    <TD><Badge dot={false}>{KIND_LABEL[r.kind as ReportKind]}</Badge></TD>
                    <TD muted>{r.study_id ? sn.get(r.study_id) ?? '—' : '—'}</TD>
                    <TD><Badge tone={r.status === 'final' || r.status === 'published' ? 'success' : 'neutral'}>{STATUS_LABEL[r.status] ?? r.status}</Badge></TD>
                    <TD muted>{fmt.ago(r.updated_at)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
