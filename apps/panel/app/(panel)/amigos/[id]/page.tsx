import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, from, explain } from '@/lib/db';
import { cn, fmt } from '@/lib/utils';
import { panelEnv } from '@/lib/env';
import { Badge, Card, CardBody, CardHeader, DL, EmptyState, ErrorNotice, PageHeader, Table, TD, TH, THead, TR } from '@/components/ui/primitives';
import { ActionButton } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm';
import { groupAction } from '@/lib/amigos-actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Grupo · Amigos de mierda' };

const roundLabel = { drafting: 'Esperando la pregunta', open: 'En juego', revealed: 'Revelada', skipped: 'Sin jugar' } as const;
const roundTone = { drafting: 'info', open: 'success', revealed: 'neutral', skipped: 'warning' } as const;
const memberLabel = { listed: 'Sin entrar', active: 'Activo', dormant: 'Pausado', left: 'Se fue' } as const;
const memberTone = { listed: 'info', active: 'success', dormant: 'warning', left: 'neutral' } as const;

export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ronda?: string }> }) {
  const { id } = await params;
  const { ronda } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: g, error } = await from('amigos', 'groups').select('*').eq('id', id).maybeSingle();
  if (error) return (<><PageHeader title="Grupo" /><ErrorNotice message={explain(error)!} /></>);
  if (!g) notFound();
  const group = g as any;

  const [mQ, rQ, sQ] = await Promise.all([
    from('amigos', 'members').select('*').eq('group_id', id).order('position'),
    from('amigos', 'rounds').select('*').eq('group_id', id).order('season', { ascending: false }).order('day', { ascending: false }),
    from('amigos', 'standings').select('member_id, points').eq('group_id', id).eq('season', group.season),
  ]);
  const members = (mQ.data ?? []) as any[];
  const rounds = (rQ.data ?? []) as any[];
  const points = new Map(((sQ.data ?? []) as any[]).map((s) => [s.member_id, s.points]));
  const name = (mid: string | null) => members.find((m) => m.id === mid)?.roster_name ?? 'BRUTAL';
  const qIds = [...new Set(rounds.map((r) => r.question_id).filter(Boolean))];
  const { data: qs } = qIds.length ? await from('amigos', 'questions').select('id, prompt, option_a, option_b, origin').in('id', qIds) : { data: [] };
  const qmap = new Map(((qs ?? []) as any[]).map((q) => [q.id, q]));

  // Teléfonos solo en test: sirven para abrir la conversación en el simulador.
  const phones = new Map<string, string>();
  if (panelEnv() === 'test') {
    const pids = members.map((m) => m.pseudonym_id).filter(Boolean);
    if (pids.length) {
      const { data: ps } = await from('core', 'node_pseudonyms').select('pseudonym_id, node_id').in('pseudonym_id', pids);
      const nodeIds = ((ps ?? []) as any[]).map((p) => p.node_id);
      const { data: ns } = nodeIds.length ? await from('core', 'nodes').select('id, phone_e164').in('id', nodeIds) : { data: [] };
      const phoneOf = new Map(((ns ?? []) as any[]).map((n) => [n.id, n.phone_e164]));
      for (const p of (ps ?? []) as any[]) phones.set(p.pseudonym_id, phoneOf.get(p.node_id));
    }
  }

  const current = rounds.find((r) => r.id === ronda) ?? rounds[0] ?? null;
  let answers: any[] = [], bets: any[] = [], voices: any[] = [];
  const audioUrls = new Map<string, string>();
  if (current) {
    const [a, b, v] = await Promise.all([
      from('amigos', 'answers').select('*').eq('round_id', current.id),
      from('amigos', 'bets').select('*').eq('round_id', current.id),
      from('amigos', 'voices').select('*').eq('round_id', current.id),
    ]);
    answers = (a.data ?? []) as any[]; bets = (b.data ?? []) as any[]; voices = (v.data ?? []) as any[];
    const paths = voices.map((x) => x.audio_path).filter(Boolean);
    if (paths.length) {
      const { data } = await db().storage.from('amigos-audio').createSignedUrls(paths, 3600);
      for (const s of data ?? []) if (s.path && s.signedUrl) audioUrls.set(s.path, s.signedUrl);
    }
  }
  const q = current ? qmap.get(current.question_id) : null;
  const choiceOf = (mid: string) => answers.find((a) => a.member_id === mid)?.choice ?? null;
  const shown = members.filter((m) => m.status !== 'left' && m.status !== 'listed');

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/amigos', label: 'Amigos de mierda' }]}
        title={group.name}
        description={`Grupo #${group.number} · código ${group.code} · temporada ${group.season} de ${group.season_days} días · pregunta a las ${group.open_hour}, revela a las ${group.reveal_hour}.`}
        actions={
          <>
            <ActionButton action={groupAction.bind(null, id, 'next_day', undefined)}>Arrancar el día siguiente</ActionButton>
            {group.status === 'paused'
              ? <ActionButton action={groupAction.bind(null, id, 'resume', undefined)}>Reanudar</ActionButton>
              : <ActionButton action={groupAction.bind(null, id, 'pause', undefined)}>Pausar</ActionButton>}
            <ConfirmAction trigger={<Button variant="danger-outline">Cerrar temporada</Button>} title="Cerrar la temporada"
              description="A cada jugador le llega su etiqueta y la tabla final. No se puede deshacer." confirmLabel="Cerrar" tone="danger"
              action={groupAction.bind(null, id, 'finish', undefined)} />
          </>
        }
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Jugadores" description="En el orden en que les toca preguntar." />
          <Table>
            <THead><tr><TH>Nombre</TH><TH>Estado</TH><TH align="right">Puntos</TH><TH align="right">Faltas</TH></tr></THead>
            <tbody>
              {members.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <span className="font-medium">{m.roster_name}</span>
                    {m.pseudonym_id === group.founder_pseudonym_id && <span className="ml-1.5 text-xs text-fg-3">armó el grupo</span>}
                    {phones.get(m.pseudonym_id) && <div><Link className="text-xs text-fg-3 hover:underline" href={`/amigos?tel=${encodeURIComponent(phones.get(m.pseudonym_id)!)}`}>ver su chat</Link></div>}
                  </TD>
                  <TD><Badge tone={memberTone[m.status as keyof typeof memberTone]}>{memberLabel[m.status as keyof typeof memberLabel]}</Badge></TD>
                  <TD align="right">{fmt.n(points.get(m.id) ?? 0)}</TD>
                  <TD align="right" muted>{m.missed}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader
            title={current ? `Día ${current.day}${current.season > 1 ? ` · temporada ${current.season}` : ''}` : 'Sin rondas'}
            description={current ? <Badge tone={roundTone[current.status as keyof typeof roundTone]}>{roundLabel[current.status as keyof typeof roundLabel]}</Badge> : undefined}
            action={current && (
              <>
                {current.status === 'drafting' && <ActionButton size="sm" action={groupAction.bind(null, id, 'open', current.id)}>Abrir ya</ActionButton>}
                {current.status === 'open' && (
                  <ConfirmAction trigger={<Button size="sm">Revelar ya</Button>} title="Revelar ahora" description="Se corrigen las apuestas y a cada uno le llega el resultado. Los que no contestaron se lo pierden." confirmLabel="Revelar" action={groupAction.bind(null, id, 'reveal', current.id)} />
                )}
              </>
            )}
          />
          {!current ? <EmptyState title="Todavía no arrancó" description="La primera ronda la arma quien creó el grupo desde su WhatsApp." /> : (
            <CardBody className="flex flex-col gap-4">
              <DL items={[
                { label: 'Pregunta', value: q ? q.prompt : 'Todavía no la eligió' },
                { label: 'De', value: current.author_member_id ? name(current.author_member_id) : 'BRUTAL' },
                { label: 'Víctima', value: current.victim_member_id ? name(current.victim_member_id) : '—' },
                { label: 'Revela', value: fmt.datetime(current.revealed_at ?? current.reveal_at) },
              ]} />
              {q && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="p-1.5 text-left text-xs font-medium uppercase text-fg-3">apuesta ↓</th>
                        {shown.map((m) => (
                          <th key={m.id} className="p-1.5 text-center font-medium">
                            {m.roster_name}
                            <div className={cn('text-xs', choiceOf(m.id) ? 'text-fg' : 'text-fg-3')}>{choiceOf(m.id) ? `${choiceOf(m.id).toUpperCase()} · ${choiceOf(m.id) === 'a' ? q.option_a : q.option_b}` : 'sin contestar'}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((row) => (
                        <tr key={row.id}>
                          <td className="p-1.5 font-medium">{row.roster_name}</td>
                          {shown.map((col) => {
                            const b = bets.find((x) => x.bettor_member_id === row.id && x.target_member_id === col.id);
                            return (
                              <td key={col.id} className={cn('p-1.5 text-center', row.id === col.id && 'text-fg-3',
                                b?.correct === true && 'bg-success-bg text-success', b?.correct === false && 'bg-danger-bg text-danger')}>
                                {row.id === col.id ? '—' : b ? b.guess.toUpperCase() : '·'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(current.summary?.lines ?? []).length > 0 && (
                <ul className="text-base text-fg">{current.summary.lines.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>
              )}
            </CardBody>
          )}
        </Card>
      </div>

      {current && (
        <Card className="mb-6">
          <CardHeader title="Audios del día" description="Lo que cada uno le dijo a su objetivo. Es el material más rico del juego: cómo se leen entre ellos." />
          {voices.length === 0 ? <EmptyState title="Sin audios en esta ronda" /> : (
            <ul className="divide-y divide-border">
              {voices.map((v) => (
                <li key={v.id} className="flex flex-col gap-1.5 px-4 py-3">
                  <div className="text-sm"><span className="font-medium">{name(v.from_member_id)}</span> → {name(v.to_member_id)}
                    {v.skipped ? <Badge className="ml-2" dot={false}>salteó</Badge> : v.rating ? <Badge className="ml-2" tone={v.rating === 'read' ? 'success' : 'danger'}>{v.rating === 'read' ? 'lo leyó' : 'no tiene idea'}</Badge> : null}
                  </div>
                  {v.audio_path && audioUrls.get(v.audio_path) && <audio controls src={audioUrls.get(v.audio_path)} className="w-full max-w-md" />}
                  {v.transcript && <p className="text-base text-fg-2">«{v.transcript}»</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="Rondas" />
        <Table>
          <THead><tr><TH>Día</TH><TH>Pregunta</TH><TH>De</TH><TH>Estado</TH><TH>Fecha</TH></tr></THead>
          <tbody>
            {rounds.map((r) => (
              <TR key={r.id}>
                <TD><Link className="font-medium hover:underline" href={`/amigos/${id}?ronda=${r.id}`}>{r.season > 1 ? `T${r.season} · ` : ''}{r.day}</Link></TD>
                <TD className="max-w-md"><span className="line-clamp-1">{qmap.get(r.question_id)?.prompt ?? '—'}</span></TD>
                <TD>{r.author_member_id ? name(r.author_member_id) : 'BRUTAL'}</TD>
                <TD><Badge tone={roundTone[r.status as keyof typeof roundTone]}>{roundLabel[r.status as keyof typeof roundLabel]}</Badge></TD>
                <TD muted>{fmt.date(r.local_date)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
