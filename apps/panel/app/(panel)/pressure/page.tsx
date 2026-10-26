import { AudioLines } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, EmptyState, ErrorNotice, PageHeader, RowLink, Table, TD, TH, THead, TR } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pressure' };

export default async function PressurePage() {
  const { data, error } = await from('pressure', 'experiment_overview').select('*').order('last_session_at', { ascending: false, nullsFirst: false });
  return (
    <>
      <PageHeader title="Pressure" description="Juegos de voz. Cada turno hablado entra como observación al perfil del nodo." />
      {error ? <ErrorNotice message={explain(error)!} /> : (
        <Card>
          {(data ?? []).length === 0 ? <EmptyState icon={<AudioLines />} title="No hay juegos" description="Un juego se arma eligiendo un formato, una personalidad y un banco de preguntas." /> : (
            <Table>
              <THead><tr><TH>Juego</TH><TH>Estado</TH><TH align="right">Conversaciones</TH><TH align="right">Cortadas</TH><TH align="right">Duración media</TH><TH>Última</TH></tr></THead>
              <tbody>
                {(data ?? []).map((e) => {
                  const s = statusOf('experiment', e.status);
                  return (
                    <TR key={e.id}>
                      <TD><RowLink href={`/pressure/${e.slug}`}>{e.name}</RowLink><div className="text-xs text-fg-3">{e.study_name ?? 'Sin estudio'}</div></TD>
                      <TD><Badge tone={s.tone}>{s.label}</Badge></TD>
                      <TD align="right">{fmt.n(e.sessions)}</TD>
                      <TD align="right" className={Number(e.interrupted) > 0 ? 'text-warning' : undefined}>{fmt.n(e.interrupted)}</TD>
                      <TD align="right">{fmt.duration(e.avg_duration_s)}</TD>
                      <TD muted>{fmt.ago(e.last_session_at)}</TD>
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
