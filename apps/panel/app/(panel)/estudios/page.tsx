import { FlaskConical } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, EmptyState, ErrorNotice, PageHeader, RowLink, Table, TD, TH, THead, TR } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Estudios' };

const stages = ['draft', 'design', 'field', 'analysis', 'published'];

export default async function EstudiosPage() {
  const { data, error } = await from('signal', 'study_overview').select('*').order('updated_at', { ascending: false });
  return (
    <>
      <PageHeader title="Estudios" description="Cada pregunta sobre la Gen Z, de la tesis a la salida. Los instrumentos son las webapps de turno." />
      {error ? <ErrorNotice message={explain(error)!} /> : (
        <Card>
          {(data ?? []).length === 0 ? (
            <EmptyState icon={<FlaskConical />} title="Todavía no hay estudios" description="Un estudio empieza con una tesis. La inteligencia propone sub-tesis e instrumentos desde ahí." />
          ) : (
            <Table>
              <THead><tr><TH>Estudio</TH><TH>Etapa</TH><TH align="right">Sub-tesis</TH><TH align="right">Instrumentos</TH><TH align="right">Nodos alcanzados</TH><TH align="right">Observaciones</TH></tr></THead>
              <tbody>
                {(data ?? []).map((s) => {
                  const st = statusOf('study', s.status);
                  const idx = stages.indexOf(s.status);
                  return (
                    <TR key={s.id}>
                      <TD><RowLink href={`/estudios/${s.slug}`}>{s.name}</RowLink><p className="mt-0.5 line-clamp-1 max-w-md text-xs text-fg-3">{s.thesis}</p></TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {idx >= 0 && <span className="tabular text-xs text-fg-3">{idx + 1}/5</span>}
                        </div>
                      </TD>
                      <TD align="right">{fmt.n(s.subtheses)}</TD>
                      <TD align="right">{fmt.n(Number(s.drops) + Number(s.experiments))}</TD>
                      <TD align="right">{fmt.n(s.nodes_reached)}</TD>
                      <TD align="right">{fmt.n(s.observations)}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
