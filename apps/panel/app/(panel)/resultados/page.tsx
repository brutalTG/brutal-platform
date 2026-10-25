import { ChartColumn } from 'lucide-react';
import { listInstruments, appLabel } from '@/lib/results-data';
import { fmt } from '@/lib/utils';
import { Badge, Card, EmptyState, ErrorNotice, PageHeader, RowLink, Table, TD, TH, THead, TR } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Resultados' };

export default async function ResultsPage() {
  let rows: Awaited<ReturnType<typeof listInstruments>> = [];
  let error: string | null = null;
  try { rows = await listInstruments(); } catch (e) { error = e instanceof Error ? e.message : 'Error'; }
  return (
    <>
      <PageHeader title="Resultados" description="Qué respondieron en cada experimento, con cortes por edad, género y zona. Desde acá se lee con IA y se arma el informe." />
      {error ? <ErrorNotice message={error} /> : (
        <Card>
          {rows.length === 0 ? <EmptyState icon={<ChartColumn />} title="Todavía no hay respuestas" description="Cuando alguien juegue un experimento publicado, aparece acá." /> : (
            <Table>
              <THead><tr><TH>Experimento</TH><TH>Tipo</TH><TH>Estudio</TH><TH align="right">Nodos</TH><TH align="right">Respuestas</TH><TH>Última</TH></tr></THead>
              <tbody>
                {rows.map((r) => (
                  <TR key={`${r.app_slug}/${r.instrument_type}/${r.instrument_id}`}>
                    <TD><RowLink href={`/resultados/${r.app_slug}/${encodeURIComponent(r.instrument_id)}`}>{r.name}</RowLink></TD>
                    <TD><Badge dot={false}>{appLabel(r.app_slug, r.instrument_type)}</Badge></TD>
                    <TD muted>{r.study_name ?? '—'}</TD>
                    <TD align="right">{fmt.n(r.nodes)}</TD>
                    <TD align="right">{fmt.n(r.observations)}</TD>
                    <TD muted>{fmt.ago(r.last_at)}</TD>
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
