import { notFound } from 'next/navigation';
import { from, explain } from '@/lib/db';
import { fmt, cn } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, CardHeader, ErrorNotice, PageHeader, Stat, Table, TD, TH, THead, TR } from '@/components/ui/primitives';
import { GroupFunnel } from './group-funnel';

export const dynamic = 'force-dynamic';

export default async function DropPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: d, error } = await from('drops', 'drop_overview').select('*').eq('slug', slug).maybeSingle();
  if (error) return <ErrorNotice message={explain(error)!} />;
  if (!d) notFound();
  const [{ data: funnel }, { data: cfg }] = await Promise.all([
    from('drops', 'card_funnel').select('*').eq('drop_id', d.id).order('position'),
    from('drops', 'drops').select('config').eq('id', d.id).maybeSingle(),
  ]);
  const joinCode = typeof (cfg as any)?.config?.join?.code === 'string' ? (cfg as any).config.join.code as string : null;

  const s = statusOf('drop', d.status);
  const first = Number(funnel?.[0]?.answered ?? 0);
  const rows = (funnel ?? []).map((c, i, all) => {
    const prev = i === 0 ? Number(d.sessions) : Number(all[i - 1].answered);
    const lost = Math.max(0, prev - Number(c.answered));
    return { ...c, lost, lostPct: prev > 0 ? (100 * lost) / prev : 0 };
  });
  const worst = rows.reduce((m, r) => (r.lostPct > m ? r.lostPct : m), 0);

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/drops', label: 'Drops' }]}
        title={d.name}
        meta={<><Badge tone={s.tone}>{s.label}</Badge><span className="text-sm text-fg-3">{d.study_name ?? 'Sin estudio'} · versión {d.version}</span></>}
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sesiones" value={fmt.n(d.sessions)} />
        <Stat label="Completadas" value={fmt.pct(d.completion_rate)} hint={`${fmt.n(d.completed)} de ${fmt.n(d.sessions)}`} tone={Number(d.completion_rate ?? 100) < 70 ? 'warning' : undefined} />
        <Stat label="Abandonos" value={fmt.n(d.abandoned)} />
        <Stat label="Duración media" value={d.avg_total_ms ? fmt.duration(Number(d.avg_total_ms) / 1000) : '—'} />
      </div>

      {joinCode && <GroupFunnel dropId={d.id} slug={d.slug} joinCode={joinCode} />}

      <Card className="mt-6">
        <CardHeader title="Recorrido carta por carta" description="Cuántos nodos llegaron a responder cada carta y dónde se fueron. La carta con más pérdida queda marcada." />
        <Table>
          <THead><tr><TH className="w-12">#</TH><TH>Carta</TH><TH>Tipo</TH><TH className="w-64">Respondieron</TH><TH align="right">Se fueron</TH><TH align="right">Latencia media</TH><TH align="right">Trampa fallada</TH></tr></THead>
          <tbody>
            {rows.map((c) => {
              const isWorst = c.lostPct === worst && worst > 0;
              const pct = first > 0 ? (100 * Number(c.answered)) / Number(d.sessions || first) : 0;
              return (
                <TR key={c.question_id}>
                  <TD muted className="tabular">{c.position + 1}</TD>
                  <TD>{c.label}</TD>
                  <TD muted>{c.card_type === 'trap' ? 'Trampa' : c.format}</TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-fg-2" style={{ width: `${Math.min(100, pct)}%` }} /></div>
                      <span className="tabular w-10 text-right text-sm">{fmt.n(c.answered)}</span>
                    </div>
                  </TD>
                  <TD align="right" className={cn(isWorst && 'font-semibold text-warning')}>{c.lost > 0 ? `${fmt.n(c.lost)} · ${fmt.pct(c.lostPct)}` : '—'}</TD>
                  <TD align="right">{c.avg_latency_ms ? `${(Number(c.avg_latency_ms) / 1000).toFixed(1)} s` : '—'}</TD>
                  <TD align="right">{Number(c.trap_failed) > 0 ? fmt.n(c.trap_failed) : '—'}</TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
