import { notFound } from 'next/navigation';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, CardBody, CardHeader, DL, EmptyState, ErrorNotice, PageHeader, Stat, Table, TD, TH, THead, TR } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function JuegoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: e, error } = await from('pressure', 'experiment_overview').select('*').eq('slug', slug).maybeSingle();
  if (error) return <ErrorNotice message={explain(error)!} />;
  if (!e) notFound();
  const [sessQ, agentsQ, defQ] = await Promise.all([
    from('pressure', 'sessions').select('id, status, started_at, duration_s, outcome').eq('experiment_id', e.id).order('started_at', { ascending: false }).limit(25),
    from('pressure', 'agents').select('environment, provider_version_id, published_at').eq('experiment_id', e.id),
    from('pressure', 'experiments').select('definition').eq('id', e.id).single(),
  ]);
  const s = statusOf('experiment', e.status);
  const def = (defQ.data?.definition ?? {}) as { personality?: { name?: string; tone?: string }; phases?: string[] };
  const agent = (env: string) => (agentsQ.data ?? []).find((a) => a.environment === env);

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/pressure', label: 'Pressure' }]}
        title={e.name}
        meta={<><Badge tone={s.tone}>{s.label}</Badge><span className="text-sm text-fg-3">{e.study_name ?? 'Sin estudio'}</span></>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Conversaciones" value={fmt.n(e.sessions)} />
        <Stat label="Completas" value={fmt.n(e.completed)} />
        <Stat label="Cortadas" value={fmt.n(e.interrupted)} tone={Number(e.interrupted) > 0 ? 'warning' : undefined} />
        <Stat label="Duración media" value={fmt.duration(e.avg_duration_s)} hint={`Máximo ${fmt.duration(e.max_duration_s)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Conversaciones" description="Las últimas 25." />
          {(sessQ.data ?? []).length === 0 ? <EmptyState title="Todavía nadie jugó" /> : (
            <Table>
              <THead><tr><TH>Cuándo</TH><TH>Estado</TH><TH align="right">Duración</TH><TH>Resultado</TH></tr></THead>
              <tbody>
                {(sessQ.data ?? []).map((x) => {
                  const st = statusOf('session', x.status);
                  const caught = (x.outcome as { caught?: boolean } | null)?.caught;
                  return (
                    <TR key={x.id}>
                      <TD muted>{fmt.datetime(x.started_at)}</TD>
                      <TD><Badge tone={st.tone}>{st.label}</Badge></TD>
                      <TD align="right">{fmt.duration(x.duration_s)}</TD>
                      <TD muted>{caught === undefined ? '—' : caught ? 'La máquina encontró la mentira' : 'El nodo ganó'}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Personalidad" />
            <CardBody>
              <DL items={[
                { label: 'Nombre', value: def.personality?.name ?? '—' },
                { label: 'Tono', value: def.personality?.tone ?? '—' },
                { label: 'Fases', value: def.phases?.join(' → ') ?? '—' },
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Publicación" description="Qué versión del agente usa cada entorno." />
            <ul className="divide-y divide-border">
              {['test', 'production'].map((env) => {
                const a = agent(env);
                return (
                  <li key={env} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-base">{env === 'test' ? 'Test' : 'Producción'}</span>
                    {a ? <Badge tone="success">{a.published_at ? `Publicado ${fmt.date(a.published_at)}` : 'Conectado'}</Badge> : <Badge tone="neutral">Sin agente</Badge>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
