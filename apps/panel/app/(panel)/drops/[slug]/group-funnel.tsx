import { from } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { groupFunnel, NO_SOURCE, type JoinEvent, type Session } from '@/lib/group-funnel';
import { Badge, Card, CardHeader, Stat, Table, TD, TH, THead, TR } from '@/components/ui/primitives';

// Link de grupo en vivo: se recalcula cada vez que se abre la página.
export async function GroupFunnel({ dropId, slug, joinCode }: { dropId: string; slug: string; joinCode: string }) {
  const [eQ, sQ] = await Promise.all([
    from('drops', 'join_events').select('event, client_id, node_id, source, created_at').eq('drop_slug', slug).order('created_at').limit(5000),
    from('drops', 'sessions').select('pseudonym_id, status, position, total_ms, archetype, started_at').eq('drop_id', dropId).limit(5000),
  ]);
  const events = (eQ.data ?? []) as JoinEvent[];
  const nodeIds = [...new Set(events.map((e) => e.node_id).filter(Boolean))] as string[];
  const [nQ, pQ] = nodeIds.length
    ? await Promise.all([
        from('core', 'nodes').select('id, nickname, status').in('id', nodeIds),
        from('core', 'node_pseudonyms').select('node_id, pseudonym_id').in('node_id', nodeIds),
      ])
    : [{ data: [] }, { data: [] }];
  const nodeOfPseudonym = new Map(((pQ.data ?? []) as { node_id: string; pseudonym_id: string }[]).map((p) => [p.pseudonym_id, p.node_id]));
  const players = ((nQ.data ?? []) as { id: string; nickname: string | null; status: string }[]).map((n) => ({ node_id: n.id, nickname: n.nickname, archived: n.status === 'archived' }));
  const sessions: Session[] = ((sQ.data ?? []) as any[]).map((s) => ({ ...s, node_id: nodeOfPseudonym.get(s.pseudonym_id) ?? null }));
  const f = groupFunnel(events, players, sessions);

  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((100 * a) / b)}%` : '—');
  const link = `/j/${joinCode}`;

  return (
    <>
      <Card className="mt-6">
        <CardHeader
          title="Link de grupo, en vivo"
          description={<>Cuenta personas (un teléfono = una), no toques. Deja afuera los jugadores archivados (pruebas). Para saber por dónde llegó cada uno, mandá el link con etiqueta: <code className="rounded bg-sunken px-1">{link}?de=grupo1</code>.</>}
        />
        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-5">
          <Stat label="Abrieron el link" value={fmt.n(f.opened)} />
          <Stat label="Pusieron apodo" value={fmt.n(f.joined)} hint={`${pct(f.joined, f.opened)} de los que abrieron`} />
          <Stat label="Empezaron" value={fmt.n(f.started)} hint={pct(f.started, f.joined)} />
          <Stat label="Terminaron" value={fmt.n(f.completed)} hint={`${pct(f.completed, f.started)} de los que empezaron`} tone={f.started > 0 && f.completed / f.started < 0.7 ? 'warning' : undefined} />
          <Stat label="Lo pasaron" value={fmt.n(f.shared)} hint={f.viaShare.opened ? `${fmt.n(f.viaShare.opened)} abrieron por reenvío, ${fmt.n(f.viaShare.joined)} entraron` : 'Nadie llegó por reenvío todavía'} />
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-4 text-sm text-fg-3">
          <span>Tiempo para terminar (mediana): <b className="text-fg">{f.medianMinutes ? `${String(f.medianMinutes).replace('.', ',')} min` : '—'}</b></span>
          {f.profiles.length > 0 && <span>· Perfiles:</span>}
          {f.profiles.map(([t, n]) => <Badge key={t} tone="neutral" dot={false}>{t} · {n}</Badge>)}
        </div>
      </Card>

      {f.sources.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Por dónde llegaron" description={`Cada etiqueta del link (?de=…). "r-…" es alguien que se lo pasó otro jugador. "${NO_SOURCE}": el link sin etiqueta.`} />
          <Table>
            <THead><tr><TH>Origen</TH><TH align="right">Abrieron</TH><TH align="right">Apodo</TH><TH align="right">Empezaron</TH><TH align="right">Terminaron</TH></tr></THead>
            <tbody>
              {f.sources.map((r) => (
                <TR key={r.source}>
                  <TD>{r.source.startsWith('r-') ? <>reenvío <span className="text-fg-3">{r.source}</span></> : r.source}</TD>
                  <TD align="right">{fmt.n(r.opened)}</TD><TD align="right">{fmt.n(r.joined)}</TD><TD align="right">{fmt.n(r.started)}</TD><TD align="right">{fmt.n(r.completed)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {f.players.length > 0 && (
        <Card className="mt-6">
          <CardHeader title={`Jugadores (${f.players.length})`} description="Los últimos que entraron arriba. Si no terminó, la carta hasta donde llegó." />
          <Table>
            <THead><tr><TH>Apodo</TH><TH>Origen</TH><TH>Estado</TH><TH align="right">Tiempo</TH><TH>Perfil</TH><TH align="right">Entró</TH></tr></THead>
            <tbody>
              {f.players.map((p, i) => (
                <TR key={`${p.nickname}-${i}`}>
                  <TD>{p.nickname}</TD>
                  <TD muted>{p.source}</TD>
                  <TD>{p.status === 'terminó' ? <Badge tone="success">terminó</Badge> : p.status === 'sin empezar' ? <Badge tone="neutral">sin empezar</Badge> : <Badge tone="warning">{`carta ${p.reached}`}</Badge>}</TD>
                  <TD align="right">{p.minutes ? `${String(p.minutes).replace('.', ',')} min` : '—'}</TD>
                  <TD muted>{p.profile ?? '—'}</TD>
                  <TD align="right" muted>{fmt.ago(p.joined_at)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
