import { notFound } from 'next/navigation';
import { from, explain } from '@/lib/db';
import { fmt, cn } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorNotice, PageHeader, RowLink, Stat, Table, TD, TH, THead, TR } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

const stages = [
  { key: 'draft', label: 'Tesis' },
  { key: 'design', label: 'Diseño' },
  { key: 'field', label: 'Campo' },
  { key: 'analysis', label: 'Señal' },
  { key: 'published', label: 'Salida' },
];

export default async function EstudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: s, error } = await from('signal', 'study_overview').select('*').eq('slug', slug).maybeSingle();
  if (error) return <ErrorNotice message={explain(error)!} />;
  if (!s) notFound();

  const [subQ, dropsQ, expQ] = await Promise.all([
    from('signal', 'subtheses').select('*').eq('study_id', s.id).order('position'),
    from('drops', 'drop_overview').select('*').eq('study_slug', slug),
    from('pressure', 'experiment_overview').select('*').eq('study_slug', slug),
  ]);
  const current = stages.findIndex((x) => x.key === s.status);
  const st = statusOf('study', s.status);

  return (
    <>
      <PageHeader crumbs={[{ href: '/estudios', label: 'Estudios' }]} title={s.name} description={s.thesis} meta={<Badge tone={st.tone}>{st.label}</Badge>} />

      <Card className="mb-6">
        <CardBody>
          <ol className="grid grid-cols-5 gap-2" aria-label="Etapas del estudio">
            {stages.map((x, i) => (
              <li key={x.key} aria-current={i === current ? 'step' : undefined}>
                <div className={cn('h-1.5 rounded-full', i < current ? 'bg-fg-2' : i === current ? 'bg-primary' : 'bg-sunken')} />
                <div className={cn('mt-2 text-sm', i === current ? 'font-medium text-fg' : 'text-fg-3')}>{x.label}</div>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sub-tesis" value={fmt.n(s.subtheses)} />
        <Stat label="Instrumentos" value={fmt.n(Number(s.drops) + Number(s.experiments))} />
        <Stat label="Nodos alcanzados" value={fmt.n(s.nodes_reached)} />
        <Stat label="Observaciones" value={fmt.n(s.observations)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sub-tesis" description="Lo que el estudio busca probar o refutar." />
          {(subQ.data ?? []).length === 0 ? <EmptyState title="Sin sub-tesis" /> : (
            <ul className="divide-y divide-border">
              {(subQ.data ?? []).map((x) => (
                <li key={x.id} className="flex gap-3 px-4 py-3">
                  <span className="tabular mt-0.5 shrink-0 rounded-sm bg-sunken px-1.5 text-xs font-medium text-fg-2">{x.code}</span>
                  <span className="text-base">{x.statement}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Instrumentos" description="Drops y juegos que miden este estudio." />
          {(dropsQ.data ?? []).length + (expQ.data ?? []).length === 0 ? <EmptyState title="Sin instrumentos" /> : (
            <Table>
              <THead><tr><TH>Instrumento</TH><TH>Estado</TH><TH align="right">Sesiones</TH></tr></THead>
              <tbody>
                {(dropsQ.data ?? []).map((d) => { const t = statusOf('drop', d.status); return (
                  <TR key={d.id}><TD><RowLink href={`/drops/${d.slug}`}>{d.name}</RowLink><div className="text-xs text-fg-3">Drop</div></TD><TD><Badge tone={t.tone}>{t.label}</Badge></TD><TD align="right">{fmt.n(d.sessions)}</TD></TR>
                ); })}
                {(expQ.data ?? []).map((e) => { const t = statusOf('experiment', e.status); return (
                  <TR key={e.id}><TD><RowLink href={`/pressure/${e.slug}`}>{e.name}</RowLink><div className="text-xs text-fg-3">Pressure</div></TD><TD><Badge tone={t.tone}>{t.label}</Badge></TD><TD align="right">{fmt.n(e.sessions)}</TD></TR>
                ); })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
