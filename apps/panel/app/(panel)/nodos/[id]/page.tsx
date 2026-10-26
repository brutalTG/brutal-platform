import { notFound } from 'next/navigation';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, CardBody, CardHeader, DL, EmptyState, ErrorNotice, PageHeader, Stat, Table, TD, TH, THead, TR } from '@/components/ui/primitives';
import { NodeActions } from './node-actions';

export const dynamic = 'force-dynamic';

export default async function NodoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: n, error } = await from('core', 'node_overview').select('*').eq('id', id).maybeSingle();
  if (error) return <ErrorNotice message={explain(error)!} />;
  if (!n) notFound();

  const [dropsQ, pressQ, traitsQ, ledgerQ, consentsQ] = await Promise.all([
    from('drops', 'sessions').select('id, status, position, started_at, drop:drops(name, slug)').eq('pseudonym_id', n.pseudonym_id).order('started_at', { ascending: false }).limit(20),
    from('pressure', 'sessions').select('id, status, duration_s, started_at, experiment:experiments(name, slug)').eq('pseudonym_id', n.pseudonym_id).order('started_at', { ascending: false }).limit(20),
    from('profile', 'traits').select('value_text, confidence, updated_at, dimension:dimensions(name)').eq('node_id', id),
    from('economy', 'ledger').select('id, currency, amount, app_slug, activity, created_at').eq('node_id', id).order('created_at', { ascending: false }).limit(10),
    from('core', 'consents').select('purpose, granted_at, revoked_at').eq('node_id', id),
  ]);

  const s = statusOf('node', n.status);
  const name = n.nickname ?? 'Nodo sin apodo';
  type Activity = { key: string; app: string; what: string; status: string; when: string; detail: string };
  const activity: Activity[] = [
    ...(dropsQ.data ?? []).map((d: any) => ({ key: d.id, app: 'Drops', what: d.drop?.name ?? 'Drop', status: d.status, when: d.started_at, detail: `llegó a la carta ${d.position}` })),
    ...(pressQ.data ?? []).map((p: any) => ({ key: p.id, app: 'Pressure', what: p.experiment?.name ?? 'Juego', status: p.status, when: p.started_at, detail: fmt.duration(p.duration_s) })),
  ].sort((a, b) => b.when.localeCompare(a.when));

  const purposes: Record<string, string> = { whatsapp_messages: 'Mensajes de WhatsApp', voice_recording: 'Grabación de voz', research_use: 'Uso en investigación', marketing: 'Comunicaciones' };

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/nodos', label: 'Nodos' }]}
        title={name}
        meta={<><Badge tone={s.tone}>{s.label}</Badge>{n.is_minor && <Badge tone="warning">Menor de edad</Badge>}<span className="text-sm text-fg-3">Alta {fmt.date(n.created_at)}</span></>}
        actions={<NodeActions id={n.id} status={n.status} name={name} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Observaciones" value={fmt.n(n.observations)} hint="Todo lo que entregó" />
        <Stat label="Rasgos conocidos" value={fmt.n(n.traits)} />
        <Stat label="Golden Tickets" value={fmt.n(n.tickets)} />
        <Stat label="Efectivo" value={fmt.usd(n.cash_usd)} hint={n.is_minor ? 'No cobra efectivo' : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader title="Actividad en todas las apps" description="Lo que hizo, de lo más reciente a lo más viejo." />
            {activity.length === 0 ? <EmptyState title="Todavía no participó" /> : (
              <Table>
                <THead><tr><TH>App</TH><TH>Instrumento</TH><TH>Estado</TH><TH>Detalle</TH><TH>Cuándo</TH></tr></THead>
                <tbody>
                  {activity.map((a) => {
                    const st = statusOf('session', a.status);
                    return (
                      <TR key={a.key}>
                        <TD muted>{a.app}</TD><TD>{a.what}</TD><TD><Badge tone={st.tone}>{st.label}</Badge></TD><TD muted>{a.detail}</TD><TD muted>{fmt.ago(a.when)}</TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="Perfil" description="Rasgos que BRUTAL aprendió de este nodo, con su confianza." />
            {(traitsQ.data ?? []).length === 0 ? (
              <EmptyState title="Sin rasgos todavía" description="Los rasgos aparecen a medida que la inteligencia lee sus observaciones." />
            ) : (
              <Table>
                <THead><tr><TH>Rasgo</TH><TH>Valor</TH><TH align="right">Confianza</TH><TH>Actualizado</TH></tr></THead>
                <tbody>
                  {(traitsQ.data ?? []).map((t: any, i: number) => (
                    <TR key={i}><TD>{t.dimension?.name}</TD><TD>{t.value_text ?? '—'}</TD><TD align="right">{t.confidence != null ? fmt.pct(Number(t.confidence) * 100) : '—'}</TD><TD muted>{fmt.ago(t.updated_at)}</TD></TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Datos" />
            <CardBody>
              <DL items={[
                { label: 'Teléfono', value: <span className="tabular">{fmt.phone(n.phone_e164)}</span> },
                { label: 'Edad', value: n.age ?? '—' },
                { label: 'Género', value: n.gender ?? '—' },
                { label: 'Zona', value: [n.city, n.province].filter(Boolean).join(', ') || '—' },
                { label: 'Llegó por', value: n.acquisition_channel ?? '—' },
                { label: 'Última actividad', value: fmt.ago(n.last_active_at) },
              ]} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Consentimientos" />
            <ul className="divide-y divide-border">
              {Object.entries(purposes).map(([k, label]) => {
                const c = (consentsQ.data ?? []).find((x) => x.purpose === k && !x.revoked_at);
                return (
                  <li key={k} className="flex items-center justify-between px-4 py-2.5 text-base">
                    <span>{label}</span>
                    {c ? <Badge tone="success">Dado</Badge> : <Badge tone="neutral">No</Badge>}
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Movimientos" description="Últimos 10." />
            {(ledgerQ.data ?? []).length === 0 ? <EmptyState title="Sin movimientos" /> : (
              <ul className="divide-y divide-border">
                {(ledgerQ.data ?? []).map((m) => (
                  <li key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-fg-2">{m.app_slug ?? '—'} · {m.activity}</span>
                    <span className="tabular font-medium">{m.currency === 'cash_usd' ? fmt.usd(m.amount) : `${Number(m.amount) > 0 ? '+' : ''}${fmt.n(m.amount)} tickets`}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
