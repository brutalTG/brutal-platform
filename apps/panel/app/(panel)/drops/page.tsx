import { Layers } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, EmptyState, ErrorNotice, Meter, PageHeader, RowLink, Table, TD, TH, THead, TR } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Drops' };

export default async function DropsPage() {
  const { data, error } = await from('drops', 'drop_overview').select('*').order('opens_at', { ascending: false, nullsFirst: false });
  return (
    <>
      <PageHeader title="Drops" description="Cartas gamificadas. Cada respuesta entra como observación al perfil del nodo." />
      {error ? <ErrorNotice message={explain(error)!} /> : (
        <Card>
          {(data ?? []).length === 0 ? <EmptyState icon={<Layers />} title="No hay Drops" description="La inteligencia puede proponer uno desde una sub-tesis." /> : (
            <Table>
              <THead><tr><TH>Drop</TH><TH>Estado</TH><TH align="right">Cartas</TH><TH align="right">Sesiones</TH><TH className="w-52">Completadas</TH><TH>Cierra</TH></tr></THead>
              <tbody>
                {(data ?? []).map((d) => {
                  const s = statusOf('drop', d.status);
                  const rate = Number(d.completion_rate ?? 0);
                  return (
                    <TR key={d.id}>
                      <TD><RowLink href={`/drops/${d.slug}`}>{d.name}</RowLink><div className="text-xs text-fg-3">{d.study_name ?? 'Sin estudio'}</div></TD>
                      <TD><Badge tone={s.tone}>{s.label}</Badge></TD>
                      <TD align="right">{fmt.n(d.questions)}</TD>
                      <TD align="right">{fmt.n(d.sessions)}</TD>
                      <TD><div className="flex items-center gap-2"><Meter value={rate} tone={rate < 70 ? 'warning' : 'success'} /><span className="tabular w-12 text-right text-sm">{fmt.pct(d.completion_rate)}</span></div></TD>
                      <TD muted>{fmt.date(d.closes_at)}</TD>
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
