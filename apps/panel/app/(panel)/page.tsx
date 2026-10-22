import { AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import {
  Badge, Card, CardBody, CardHeader, EmptyState, ErrorNotice, Meter, PageHeader, RowLink, Stat, Table, TD, TH, THead, TR,
} from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Hoy' };

type Kpis = {
  active_nodes: number; new_nodes_7d: number; pending_nodes: number; observations_7d: number; live_drops: number;
  pressure_sessions_7d: number; pressure_interrupted_7d: number; pending_withdrawals: number; rejected_templates: number;
};

export default async function HoyPage() {
  const [kpisQ, dropsQ, expQ, logQ] = await Promise.all([
    from('core', 'ops_kpis').select('*').single(),
    from('drops', 'drop_overview').select('*').in('status', ['live', 'scheduled']).order('opens_at', { ascending: false }),
    from('pressure', 'experiment_overview').select('*').in('status', ['live', 'testing']).order('last_session_at', { ascending: false }),
    from('core', 'audit_log').select('*').in('actor_type', ['claude', 'system']).order('created_at', { ascending: false }).limit(6),
  ]);

  const error = explain(kpisQ.error) ?? explain(dropsQ.error) ?? explain(expQ.error) ?? explain(logQ.error);
  if (error) {
    return (
      <>
        <PageHeader title="Hoy" description="Lo que necesita atención ahora." />
        <ErrorNotice message={error} />
      </>
    );
  }

  const k = kpisQ.data as Kpis;
  const n = (v: unknown) => Number(v ?? 0);
  const attention = [
    n(k.pending_withdrawals) > 0 && { tone: 'warning' as const, text: `${fmt.n(k.pending_withdrawals)} retiros de efectivo esperan aprobación`, href: '/recompensas' },
    n(k.rejected_templates) > 0 && { tone: 'danger' as const, text: `${fmt.n(k.rejected_templates)} plantilla de WhatsApp rechazada por Meta`, href: '/mensajes' },
    n(k.pressure_interrupted_7d) > 0 && { tone: 'warning' as const, text: `${fmt.n(k.pressure_interrupted_7d)} conversaciones de Pressure se cortaron esta semana`, href: '/pressure' },
    n(k.pending_nodes) > 0 && { tone: 'info' as const, text: `${fmt.n(k.pending_nodes)} nodos esperan activación`, href: '/nodos?estado=pending' },
  ].filter(Boolean) as { tone: 'warning' | 'danger' | 'info'; text: string; href: string }[];

  return (
    <>
      <PageHeader
        title="Hoy"
        description="El campo en curso, lo que requiere una decisión y lo que propuso la inteligencia."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nodos activos" value={fmt.n(k.active_nodes)} hint={`${fmt.n(k.new_nodes_7d)} nuevos en 7 días`} href="/nodos?estado=active" />
        <Stat label="Observaciones · 7 días" value={fmt.n(k.observations_7d)} hint="Todo lo que entregaron las webapps" />
        <Stat label="Drops en vivo" value={fmt.n(k.live_drops)} href="/drops" />
        <Stat label="Conversaciones · 7 días" value={fmt.n(k.pressure_sessions_7d)} hint={`${fmt.n(k.pressure_interrupted_7d)} cortadas`} tone={n(k.pressure_interrupted_7d) > 0 ? 'warning' : undefined} href="/pressure" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Requiere atención" description="Decisiones pendientes, ordenadas por urgencia." />
          {attention.length === 0 ? (
            <EmptyState icon={<CheckCircle2 />} title="Nada pendiente" description="Cuando algo necesite una decisión, aparece acá." />
          ) : (
            <ul className="divide-y divide-border">
              {attention.map((a) => (
                <li key={a.text} className="flex items-center gap-3 px-4 py-3">
                  <AlertTriangle className={a.tone === 'danger' ? 'size-4 text-danger' : a.tone === 'warning' ? 'size-4 text-warning' : 'size-4 text-info'} aria-hidden />
                  <span className="flex-1 text-base">{a.text}</span>
                  <ButtonLink href={a.href} size="sm">Revisar</ButtonLink>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Bitácora" description="Lo último que hizo o propuso la inteligencia." action={<ButtonLink href="/bitacora" size="sm" variant="ghost">Ver todo</ButtonLink>} />
          {(logQ.data ?? []).length === 0 ? (
            <EmptyState icon={<Sparkles />} title="Sin movimientos" />
          ) : (
            <ul className="divide-y divide-border">
              {(logQ.data ?? []).map((e) => {
                const a = statusOf('actor', e.actor_type);
                return (
                  <li key={e.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={a.tone} dot={false}>{a.label}</Badge>
                      <span className="text-sm font-medium text-fg">{e.action}</span>
                      <span className="ml-auto whitespace-nowrap text-xs text-fg-3">{fmt.ago(e.created_at)}</span>
                    </div>
                    {e.details?.summary && <p className="mt-1 text-sm text-fg-2">{e.details.summary}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Campo en curso" description="Instrumentos abiertos ahora mismo." />
        {(dropsQ.data ?? []).length + (expQ.data ?? []).length === 0 ? (
          <EmptyState title="No hay instrumentos abiertos" description="Cuando un Drop o un juego de Pressure esté en vivo, su avance aparece acá." />
        ) : (
          <Table>
            <THead>
              <tr><TH>Instrumento</TH><TH>Estudio</TH><TH>Estado</TH><TH align="right">Sesiones</TH><TH className="w-48">Completadas</TH></tr>
            </THead>
            <tbody>
              {(dropsQ.data ?? []).map((d) => {
                const s = statusOf('drop', d.status);
                const rate = Number(d.completion_rate ?? 0);
                return (
                  <TR key={d.id}>
                    <TD><RowLink href={`/drops/${d.slug}`}>{d.name}</RowLink><div className="text-xs text-fg-3">Drop</div></TD>
                    <TD muted>{d.study_name ?? '—'}</TD>
                    <TD><Badge tone={s.tone}>{s.label}</Badge></TD>
                    <TD align="right">{fmt.n(d.sessions)}</TD>
                    <TD><div className="flex items-center gap-2"><Meter value={rate} tone={rate < 70 ? 'warning' : 'success'} /><span className="tabular w-12 text-right text-sm">{fmt.pct(d.completion_rate)}</span></div></TD>
                  </TR>
                );
              })}
              {(expQ.data ?? []).map((e) => {
                const s = statusOf('experiment', e.status);
                const rate = Number(e.sessions) > 0 ? (100 * Number(e.completed)) / Number(e.sessions) : 0;
                return (
                  <TR key={e.id}>
                    <TD><RowLink href={`/pressure/${e.slug}`}>{e.name}</RowLink><div className="text-xs text-fg-3">Pressure</div></TD>
                    <TD muted>{e.study_name ?? '—'}</TD>
                    <TD><Badge tone={s.tone}>{s.label}</Badge></TD>
                    <TD align="right">{fmt.n(e.sessions)}</TD>
                    <TD><div className="flex items-center gap-2"><Meter value={rate} tone={rate < 70 ? 'warning' : 'success'} /><span className="tabular w-12 text-right text-sm">{fmt.pct(rate)}</span></div></TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
