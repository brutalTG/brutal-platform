import { notFound } from 'next/navigation';
import { db, from, explain } from '@/lib/db';
import { fmt, cn } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { publicAlias } from '@/lib/alias';
import { Badge, Card, CardHeader, DL, CardBody, ErrorNotice, PageHeader, RowLink, Stat, Table, TD, TH, THead, TR } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

type Ev = { seq: number; type: string; payload: any; created_at: string };

const STATED: Record<string, string> = { yes: 'Sí', no: 'No', agree: 'De acuerdo', disagree: 'En desacuerdo', unclear: 'No se entendió', number: 'Número', open: 'Libre' };
const REASON: Record<string, string> = { decision: 'Dudó antes de marcar', onset: 'Tardó en hablar', speech: 'Habló distinto', pauses: 'Se frenó', fillers: 'Muletillas', pitch: 'Le subió la voz' };

export default async function PartidaPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const { data: s, error } = await from('pressure', 'sessions').select('*').eq('id', id).maybeSingle();
  if (error) return <ErrorNotice message={explain(error)!} />;
  if (!s) notFound();
  const [evQ, itemsQ, nodeQ] = await Promise.all([
    from('pressure', 'events').select('seq, type, payload, created_at').eq('session_id', id).order('seq'),
    from('pressure', 'items').select('id, section, position, kind, prompt, screen_text, follow_up').eq('experiment_id', s.experiment_id),
    from('core', 'node_pseudonyms').select('node_id').eq('pseudonym_id', s.pseudonym_id).maybeSingle(),
  ]);
  const events = (evQ.data ?? []) as Ev[];
  const items = (itemsQ.data ?? []) as { id: string; section: string; position: number; kind: string; prompt: string; screen_text: string | null; follow_up: string | null }[];
  const picks = new Map<string, { reason: string; score: number }>(((s.outcome?.picks ?? []) as { item_id: string; reason: string; score: number }[]).map((p) => [p.item_id, p]));
  const answers = events.filter((e) => e.type === 'answer');
  const commit = (itemId: string) => events.find((e) => e.type === 'commit' && e.payload.item_id === itemId)?.payload.committed as string | undefined;
  const lastAnswer = (itemId: string, stage: string) => answers.filter((a) => a.payload.item_id === itemId && a.payload.stage === stage).at(-1)?.payload;

  // Audios: links firmados que vencen en una hora. Nunca públicos.
  const paths = answers.map((a) => a.payload.audio_path).filter((p): p is string => typeof p === 'string');
  const audio = new Map<string, string>();
  if (paths.length) {
    const { data } = await db().storage.from('pressure-audio').createSignedUrls(paths, 3600);
    for (const d of data ?? []) if (d.signedUrl && d.path) audio.set(d.path, d.signedUrl);
  }
  const player = (path?: string) => (path && audio.get(path) ? <audio controls preload="none" src={audio.get(path)} className="mt-1.5 h-8 w-full max-w-xs" /> : null);

  const st = statusOf('session', s.status), v = statusOf('verdict', s.verdict);
  const ordered = [...items.filter((i) => i.section === 'calibration').sort((a, b) => a.position - b.position), ...items.filter((i) => i.section === 'game').sort((a, b) => a.position - b.position)]
    .filter((i) => answers.some((a) => a.payload.item_id === i.id));
  const ms = (x: unknown) => (typeof x === 'number' ? `${fmt.n(Math.round(x / 100) / 10)} s` : '—');

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/pressure', label: 'Pressure' }, { href: `/pressure/${slug}?tab=partidas`, label: 'Partidas' }]}
        title={`Partida de ${publicAlias(s.pseudonym_id)}`}
        meta={<><Badge tone={st.tone}>{st.label}</Badge>{s.verdict && <Badge tone={v.tone}>{v.label}</Badge>}{s.replay && <Badge tone="neutral" dot={false}>Revancha</Badge>}<span className="text-sm text-fg-3">{fmt.datetime(s.started_at)} · contenido v{s.content_version ?? '—'}</span></>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Mentiras encontradas" value={s.lies ? `${s.caught} de ${s.lies}` : '—'} />
        <Stat label="Tickets" value={fmt.n(s.tickets)} hint={s.outcome?.tickets ? `${s.outcome.tickets.progress} por terminar · ${s.outcome.tickets.win} por ganar` : undefined} />
        <Stat label="Duración" value={fmt.duration(s.duration_s)} />
        <Stat label="Respuestas" value={fmt.n(answers.length)} />
      </div>

      <Card>
        <CardHeader title="Pregunta por pregunta" description="Lo que marcó en secreto, lo que dijo y cómo sonó, con su audio. En rojo, donde acusó la máquina." />
        <Table>
          <THead><tr><TH className="w-10">#</TH><TH>Pregunta y respuesta</TH><TH>Marcó</TH><TH>Dijo</TH><TH align="right">Dudó</TH><TH align="right">Arrancó</TH><TH align="right">Habló</TH><TH align="right">Pausas</TH><TH>Máquina</TH></tr></THead>
          <tbody>
            {ordered.map((i) => {
              const main = lastAnswer(i.id, 'main'), follow = lastAnswer(i.id, 'follow');
              const c = i.section === 'game' ? commit(i.id) : i.kind === 'obvious_lie' ? 'lie' : 'truth';
              const p = picks.get(i.id);
              const f = main?.features ?? {};
              return (
                <TR key={i.id}>
                  <TD className={cn('tabular align-top pt-3', p && 'font-semibold text-danger')}>{i.section === 'game' ? i.position : `C${i.position}`}</TD>
                  <TD className="py-2.5 align-top">
                    <div className="max-w-md text-sm text-fg-3">{i.screen_text ?? i.prompt}</div>
                    <div className="mt-0.5 max-w-md text-base text-fg">{main?.transcript ? `“${main.transcript}”` : <span className="text-fg-3">Sin transcripción</span>}</div>
                    {player(main?.audio_path)}
                    {follow && <div className="mt-1 max-w-md text-sm text-fg-2">↳ {i.follow_up} <span className="text-fg">“{follow.transcript || '—'}”</span></div>}
                    {follow && player(follow.audio_path)}
                    {main?.stt_error && <div className="mt-1 text-xs text-warning">No se pudo transcribir: {main.stt_error}</div>}
                  </TD>
                  <TD className="align-top pt-2.5">{c === 'lie' ? <Badge tone="danger">Mentira</Badge> : <Badge tone="neutral">Verdad</Badge>}</TD>
                  <TD className="align-top pt-3 text-sm">{STATED[main?.parsed] ?? '—'}{main?.value != null ? ` (${main.value})` : ''}</TD>
                  <TD align="right" className="align-top pt-3">{ms(f.decision_ms)}</TD>
                  <TD align="right" className="align-top pt-3">{ms(f.onset_ms)}</TD>
                  <TD align="right" className="align-top pt-3">{ms(f.speech_ms)}</TD>
                  <TD align="right" className="align-top pt-3">{f.pauses ?? '—'}</TD>
                  <TD className="align-top pt-2.5">{p ? <Badge tone={c === 'lie' ? 'danger' : 'warning'}>{c === 'lie' ? 'La agarró' : 'Falsa alarma'}</Badge> : c === 'lie' ? <Badge tone="success">Se le pasó</Badge> : null}
                    {p && <div className="mt-1 text-xs text-fg-3">{REASON[p.reason] ?? p.reason}</div>}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Datos" />
        <CardBody>
          <DL items={[
            { label: 'Nodo', value: nodeQ.data ? <RowLink href={`/nodos/${(nodeQ.data as { node_id: string }).node_id}`}>Ver ficha</RowLink> : '—' },
            { label: 'Dispositivo', value: <span className="text-sm">{s.outcome?.device?.ua ?? '—'}</span> },
            { label: 'Empezó', value: fmt.datetime(s.started_at) },
            { label: 'Terminó', value: fmt.datetime(s.ended_at) },
          ]} />
        </CardBody>
      </Card>
    </>
  );
}
