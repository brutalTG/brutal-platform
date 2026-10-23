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
    from('pressure', 'items').select('id, section, position, kind, prompt, screen_text, follow_up, emoji_a, emoji_b, echo, correct').eq('experiment_id', s.experiment_id),
    from('core', 'node_pseudonyms').select('node_id').eq('pseudonym_id', s.pseudonym_id).maybeSingle(),
  ]);
  const events = (evQ.data ?? []) as Ev[];
  const items = (itemsQ.data ?? []) as { id: string; section: string; position: number; kind: string; prompt: string; screen_text: string | null; follow_up: string | null; emoji_a: string | null; emoji_b: string | null; echo: boolean; correct: string | null }[];
  const taps = events.filter((e) => e.type === 'tap');
  const guesses = events.filter((e) => e.type === 'hilo_guess').map((e) => e.payload);
  const hiloDone = events.find((e) => e.type === 'hilo_done')?.payload;
  const FACE: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const card = (n: number) => FACE[n] ?? String(n);
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
  const bySection = (sec: string) => items.filter((i) => i.section === sec).sort((a, b) => a.position - b.position);
  const ordered = [...bySection('calibration'), ...bySection('game'), ...bySection('rafaga')]
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
        <Stat label="Tickets" value={fmt.n(s.tickets)} hint={s.outcome?.tickets ? `${s.outcome.tickets.progress} por terminar · ${s.outcome.tickets.win} por ganar${(s.outcome.tickets.multiplier ?? 1) > 1 ? ` · con x${s.outcome.tickets.multiplier}` : ''}` : undefined} />
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
              const c = i.section !== 'calibration' ? commit(i.id) : i.kind === 'obvious_lie' ? 'lie' : 'truth';
              const p = picks.get(i.id);
              const f = main?.features ?? {};
              return (
                <TR key={i.id}>
                  <TD className={cn('tabular align-top pt-3', p && 'font-semibold text-danger')}>{i.section === 'game' ? i.position : i.section === 'rafaga' ? `V${i.position}` : `C${i.position}`}</TD>
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

      {taps.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Ráfaga" description="Lo que tocó sin pensar. Si la card volvió por voz, al lado está lo que dijo después y si coincide." />
          <Table>
            <THead><tr><TH className="w-10">#</TH><TH>Card</TH><TH>Tocó</TH><TH align="right">Tardó</TH><TH>Después dijo</TH></tr></THead>
            <tbody>
              {taps.map((t) => {
                const it = items.find((x) => x.id === t.payload.item_id);
                const emoji = t.payload.choice === 'a' ? it?.emoji_a : t.payload.choice === 'b' ? it?.emoji_b : null;
                const said = it?.echo ? lastAnswer(it.id, 'main') : null;
                const saidSide = said ? (['yes', 'agree', 'a'].includes(said.parsed) ? 'a' : ['no', 'disagree', 'b'].includes(said.parsed) ? 'b' : null) : null;
                const lied = it?.echo ? commit(it.id) === 'lie' : false;
                return (
                  <TR key={t.seq}>
                    <TD className="tabular">{t.payload.position}</TD>
                    <TD className="text-sm">{it?.screen_text ?? '—'}{it?.kind === 'trap' && <Badge tone="warning" dot={false} className="ml-2">Trampa</Badge>}</TD>
                    <TD className="text-lg">{emoji ?? <span className="text-sm text-fg-3">No tocó</span>}{t.payload.trap_failed && <Badge tone="danger" className="ml-2">Falló</Badge>}</TD>
                    <TD align="right">{ms(t.payload.latency_ms)}</TD>
                    <TD className="text-sm">
                      {said ? <>
                        {saidSide ? (saidSide === 'a' ? it?.emoji_a : it?.emoji_b) : STATED[said.parsed] ?? '—'}
                        {lied && <Badge tone="danger" dot={false} className="ml-2">Mentira declarada</Badge>}
                        {!lied && saidSide && t.payload.choice && saidSide !== t.payload.choice && <Badge tone="warning" className="ml-2">Dijo lo contrario sin mentir</Badge>}
                      </> : <span className="text-fg-3">—</span>}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {(guesses.length > 0 || hiloDone) && (
        <Card className="mt-6">
          <CardHeader title="Mayor o menor" description={hiloDone ? (hiloDone.stood ? `Se plantó con x${hiloDone.multiplier} después de ${hiloDone.steps} aciertos.` : hiloDone.busted ? `Siguió apostando y perdió después de ${hiloDone.steps} aciertos: x1.` : `Llegó al tope: x${hiloDone.multiplier}.`) : 'No terminó.'} />
          <CardBody>
            <ol className="flex flex-wrap gap-2 text-sm">
              {guesses.map((g: any) => (
                <li key={g.step} className={cn('rounded border px-2.5 py-1', g.ok ? 'border-border' : 'border-danger text-danger')}>
                  {card(g.card)} → {g.guess === 'higher' ? 'mayor' : 'menor'} → {card(g.next)} {g.ok ? '✓' : '✗'}
                </li>
              ))}
              {hiloDone?.stood && <li className="rounded border border-border px-2.5 py-1 font-medium">Se plantó con {card(hiloDone.last_card)} en la mesa</li>}
            </ol>
          </CardBody>
        </Card>
      )}

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
