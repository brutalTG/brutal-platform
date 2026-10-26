import { Coins } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorNotice, PageHeader, Table, TD, TH, THead, TR } from '@/components/ui/primitives';
import { WithdrawalActions } from './withdrawal-actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recompensas' };

const activityLabel: Record<string, string> = {
  question_answered: 'Responder una carta',
  drop_completed: 'Completar un Drop',
  session_completed: 'Completar una conversación',
};

export default async function RecompensasPage() {
  const [seasonQ, rulesQ, wQ] = await Promise.all([
    from('economy', 'seasons').select('*').eq('status', 'active').maybeSingle(),
    from('economy', 'reward_rules').select('*').eq('is_active', true).order('app_slug'),
    from('economy', 'withdrawals').select('*').order('requested_at', { ascending: false }).limit(25),
  ]);
  const error = explain(seasonQ.error) ?? explain(rulesQ.error) ?? explain(wQ.error);
  if (error) return (<><PageHeader title="Recompensas" /><ErrorNotice message={error} /></>);

  const season = seasonQ.data;
  let ranking: { node_id: string; tickets: number; nickname?: string }[] = [];
  if (season) {
    const { data: t } = await from('economy', 'season_tickets').select('node_id, tickets').eq('season_id', season.id).order('tickets', { ascending: false }).limit(10);
    const ids = (t ?? []).map((x) => x.node_id);
    const { data: names } = ids.length ? await from('core', 'nodes').select('id, nickname').in('id', ids) : { data: [] };
    ranking = (t ?? []).map((x) => ({ ...x, nickname: names?.find((n) => n.id === x.node_id)?.nickname }));
  }
  const daysLeft = season ? Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 864e5) : 0;

  return (
    <>
      <PageHeader title="Recompensas" description="Temporadas, cuánto paga cada actividad y los retiros de efectivo. Los menores cobran solo Golden Tickets." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title={season ? season.name : 'Sin temporada activa'}
            description={season ? `${fmt.date(season.starts_at)} al ${fmt.date(season.ends_at)} · quedan ${daysLeft} días` : 'Sin temporada activa no se acumula ranking.'}
            action={season && <Badge tone={statusOf('season', season.status).tone}>{statusOf('season', season.status).label}</Badge>}
          />
          {ranking.length === 0 ? <EmptyState title="Sin ranking todavía" /> : (
            <Table>
              <THead><tr><TH className="w-12">#</TH><TH>Nodo</TH><TH align="right">Tickets de la temporada</TH></tr></THead>
              <tbody>
                {ranking.map((r, i) => (
                  <TR key={r.node_id}><TD muted className="tabular">{i + 1}</TD><TD>{r.nickname ?? 'Sin apodo'}</TD><TD align="right">{fmt.n(r.tickets)}</TD></TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Premios" />
          <CardBody>
            {season && Array.isArray(season.prizes) && season.prizes.length > 0 ? (
              <ol className="flex flex-col gap-2">
                {(season.prizes as { rank: number; prize: string }[]).map((p) => (
                  <li key={p.rank} className="flex items-center justify-between text-base"><span className="text-fg-3">Puesto {p.rank}</span><span className="font-medium">{p.prize}</span></li>
                ))}
              </ol>
            ) : <p className="text-sm text-fg-3">Sin premios cargados.</p>}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Cuánto paga cada actividad" description="Cada app declara sus actividades; acá se les pone precio." />
        {(rulesQ.data ?? []).length === 0 ? <EmptyState icon={<Coins />} title="Sin reglas" /> : (
          <Table>
            <THead><tr><TH>App</TH><TH>Actividad</TH><TH align="right">Mayores</TH><TH align="right">Menores</TH></tr></THead>
            <tbody>
              {(rulesQ.data ?? []).map((r) => (
                <TR key={r.id}>
                  <TD className="capitalize">{r.app_slug}</TD>
                  <TD>{activityLabel[r.activity] ?? r.activity}</TD>
                  <TD align="right">{r.adult_currency === 'cash_usd' ? fmt.usd(r.adult_amount) : `${fmt.n(r.adult_amount)} tickets`}</TD>
                  <TD align="right">{fmt.n(r.minor_tickets)} tickets</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Retiros de efectivo" description="Cada retiro necesita una persona que lo apruebe." />
        {(wQ.data ?? []).length === 0 ? <EmptyState title="No hay retiros" description="Cuando un nodo pida retirar efectivo, aparece acá para aprobar o rechazar." /> : (
          <Table>
            <THead><tr><TH>Pedido</TH><TH align="right">Monto</TH><TH>Alias</TH><TH>Estado</TH><TH align="right">Acciones</TH></tr></THead>
            <tbody>
              {(wQ.data ?? []).map((w) => {
                const s = statusOf('withdrawal', w.status);
                return (
                  <TR key={w.id}>
                    <TD muted>{fmt.datetime(w.requested_at)}</TD>
                    <TD align="right">{fmt.usd(w.amount_usd)}</TD>
                    <TD className="font-mono text-sm">{w.wallet_alias}</TD>
                    <TD><Badge tone={s.tone}>{s.label}</Badge></TD>
                    <TD align="right">{w.status === 'pending' ? <WithdrawalActions id={w.id} amount={fmt.usd(w.amount_usd)} /> : <span className="text-sm text-fg-3">{fmt.date(w.resolved_at)}</span>}</TD>
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
