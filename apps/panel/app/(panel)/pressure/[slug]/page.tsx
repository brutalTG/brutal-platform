import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink, Trophy } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt, cn } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import {
  Badge, Card, CardHeader, EmptyState, ErrorNotice, Meter, PageHeader, RowLink, Stat, Table, Tabs, TD, TH, THead, TR,
} from '@/components/ui/primitives';
import { publicAlias as alias } from '@/lib/alias';
import { AddItemButton, ItemActions, SettingsForm, StatusControl, type Item, type Section, type Subthesis } from './editor';

export const dynamic = 'force-dynamic';

type Session = {
  id: string; pseudonym_id: string; status: string; replay: boolean; verdict: string | null; caught: number | null; lies: number | null;
  tickets: number; started_at: string; duration_s: number | null; content_version: number | null;
};

export default async function JuegoPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { slug } = await params;
  const tab = (await searchParams).tab ?? 'contenido';
  const { data: e, error } = await from('pressure', 'experiments').select('id, slug, name, status, content_version, study_id, definition').eq('slug', slug).maybeSingle();
  if (error) return <ErrorNotice message={explain(error)!} />;
  if (!e) notFound();

  const [itemsQ, subQ, sessQ, rankQ] = await Promise.all([
    from('pressure', 'items').select('*').eq('experiment_id', e.id).order('section').order('position'),
    e.study_id ? from('signal', 'subtheses').select('id, code, statement').eq('study_id', e.study_id).order('position') : Promise.resolve({ data: [], error: null }),
    from('pressure', 'sessions').select('id, pseudonym_id, status, replay, verdict, caught, lies, tickets, started_at, duration_s, content_version')
      .eq('experiment_id', e.id).order('started_at', { ascending: false }).limit(200),
    from('pressure', 'detector_ranking').select('*').eq('experiment_id', e.id).order('wins', { ascending: false }).order('lies_passed', { ascending: false, nullsFirst: false }).limit(50),
  ]);
  const err = explain(itemsQ.error) ?? explain(sessQ.error) ?? explain(rankQ.error);
  if (err) return <ErrorNotice message={err} />;

  const items = (itemsQ.data ?? []) as Item[];
  const subtheses = (subQ.data ?? []) as Subthesis[];
  const sessions = (sessQ.data ?? []) as Session[];
  const def = e.definition as Parameters<typeof SettingsForm>[0]['def'];
  const s = statusOf('experiment', e.status);
  const completed = sessions.filter((x) => x.status === 'completed');
  const paid = completed.filter((x) => !x.replay);
  const wins = completed.filter((x) => x.verdict === 'escaped').length;
  const totalLies = completed.reduce((a, x) => a + (x.lies ?? 0), 0);
  const caught = completed.reduce((a, x) => a + (x.caught ?? 0), 0);
  const cut = sessions.filter((x) => x.status === 'interrupted').length;
  const base = `/pressure/${slug}`;
  const testOrigin = process.env.BRUTAL_ENV === 'production' ? 'https://pressure.brutal.lat' : 'https://test-pressure.brutal.lat';

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/pressure', label: 'Pressure' }]}
        title={e.name}
        description="Detector de mentiras con voz. 10 preguntas, el jugador elige en cuáles miente y la máquina tiene que encontrarlas."
        meta={<><Badge tone={s.tone}>{s.label}</Badge><span className="text-sm text-fg-3">Contenido versión {e.content_version}</span></>}
        actions={<><Link href={testOrigin} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded px-3 text-sm text-fg-2 hover:bg-sunken"><ExternalLink className="size-4" />Webapp</Link><StatusControl id={e.id} status={e.status} /></>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Partidas terminadas" value={fmt.n(completed.length)} hint={`${fmt.n(paid.length)} con premio`} href={`${base}?tab=partidas`} />
        <Stat label="Le ganaron a la máquina" value={completed.length ? fmt.pct((100 * wins) / completed.length) : '—'} hint={`${fmt.n(wins)} de ${fmt.n(completed.length)}`} />
        <Stat label="Mentiras encontradas" value={totalLies ? fmt.pct((100 * caught) / totalLies) : '—'} hint="Al azar acertaría 30%" />
        <Stat label="Cortadas" value={fmt.n(cut)} tone={cut > 0 ? 'warning' : undefined} hint="Empezaron y no terminaron" />
      </div>

      <Tabs active={tab} items={[
        { key: 'contenido', label: 'Contenido', href: base, count: items.filter((i) => i.enabled && i.section === 'game').length },
        { key: 'partidas', label: 'Partidas', href: `${base}?tab=partidas`, count: sessions.length },
        { key: 'ranking', label: 'Ranking', href: `${base}?tab=ranking` },
        { key: 'ajustes', label: 'Ajustes', href: `${base}?tab=ajustes` },
      ]} />

      {tab === 'contenido' && (
        <div className="flex flex-col gap-6">
          <ItemTable title="Calibración" description="Antes del juego. Verdades obligatorias y una mentira de control: así la máquina aprende cómo suena cada uno."
            items={items.filter((i) => i.section === 'calibration')} experimentId={e.id} section="calibration" subtheses={subtheses} />
          <ItemTable title="Ráfaga" description={`Después de calibrar. ${def.rafaga?.seconds ?? 3} segundos por card, se contesta tocando un emoji. Las marcadas “vuelve por voz” se repiten al final, hablando y con permiso para mentir.${def.stages?.rafaga ? '' : ' Apagada en Ajustes → Etapas.'}`}
            items={items.filter((i) => i.section === 'rafaga')} experimentId={e.id} section="rafaga" subtheses={subtheses} />
          <ItemTable title="Preguntas del juego" description={`En ${def.rules.lies} de estas el jugador miente. Ideal: 8 de diversión por cada 2 de señal.`}
            items={items.filter((i) => i.section === 'game')} experimentId={e.id} section="game" subtheses={subtheses} />
        </div>
      )}

      {tab === 'partidas' && (
        <Card>
          <CardHeader title="Partidas" description="Las últimas 200. Las revanchas no cobran tickets." />
          {sessions.length === 0 ? <EmptyState title="Todavía nadie jugó" description="Cuando un invitado escriba por WhatsApp y entre al link, aparece acá." /> : (
            <Table>
              <THead><tr><TH>Cuándo</TH><TH>Nodo</TH><TH>Estado</TH><TH>Resultado</TH><TH align="right">Mentiras encontradas</TH><TH align="right">Tickets</TH><TH align="right">Duración</TH></tr></THead>
              <tbody>
                {sessions.map((x) => {
                  const st = statusOf('session', x.status);
                  const v = statusOf('verdict', x.verdict);
                  return (
                    <TR key={x.id}>
                      <TD><RowLink href={`${base}/partidas/${x.id}`}>{fmt.datetime(x.started_at)}</RowLink></TD>
                      <TD className="font-mono text-sm">{alias(x.pseudonym_id)}</TD>
                      <TD><Badge tone={st.tone}>{st.label}</Badge>{x.replay && <Badge tone="neutral" dot={false} className="ml-1">Revancha</Badge>}</TD>
                      <TD>{x.verdict ? <Badge tone={v.tone}>{v.label}</Badge> : <span className="text-fg-3">—</span>}</TD>
                      <TD align="right">{x.lies ? `${x.caught} de ${x.lies}` : '—'}</TD>
                      <TD align="right">{x.tickets ? fmt.n(x.tickets) : '—'}</TD>
                      <TD align="right">{fmt.duration(x.duration_s)}</TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === 'ranking' && (
        <Card>
          <CardHeader title="Los que mejor le mienten a la máquina" description="Ordenado por partidas ganadas y mentiras que pasaron. Así lo ven los nodos: solo el alias." />
          {(rankQ.data ?? []).length === 0 ? <EmptyState icon={<Trophy />} title="Sin ranking todavía" /> : (
            <Table>
              <THead><tr><TH>#</TH><TH>Nodo</TH><TH align="right">Partidas</TH><TH align="right">Ganadas</TH><TH align="right">Mentiras que pasaron</TH><TH align="right">Mejor premio</TH><TH>Última</TH></tr></THead>
              <tbody>
                {(rankQ.data ?? []).map((r, i) => (
                  <TR key={r.pseudonym_id}>
                    <TD className={cn('tabular', i < 3 && 'font-semibold')}>{i + 1}</TD>
                    <TD className="font-mono text-sm">{r.alias}</TD>
                    <TD align="right">{fmt.n(r.plays)}</TD>
                    <TD align="right">{fmt.n(r.wins)}</TD>
                    <TD align="right">{fmt.n(r.lies_passed)}</TD>
                    <TD align="right">{fmt.n(r.best_tickets)}</TD>
                    <TD muted>{fmt.ago(r.last_played_at)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === 'ajustes' && <SettingsForm experimentId={e.id} def={def} />}
    </>
  );
}


function ItemTable({ title, description, items, experimentId, section, subtheses }: {
  title: string; description: string; items: Item[]; experimentId: string; section: Section; subtheses: Subthesis[];
}) {
  const code = (id: string | null) => subtheses.find((s) => s.id === id)?.code;
  const active = items.filter((i) => i.enabled);
  const signal = active.filter((i) => i.kind === 'signal').length;
  return (
    <Card>
      <CardHeader title={title} description={description} action={<AddItemButton experimentId={experimentId} section={section} subtheses={subtheses} />} />
      {section === 'game' && active.length > 0 && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm text-fg-3">
          <span className="w-40 shrink-0">{signal} de señal · {active.length - signal} de diversión</span>
          <Meter value={signal} max={active.length} tone={signal / active.length > 0.35 ? 'warning' : 'neutral'} />
        </div>
      )}
      {items.length === 0 ? <EmptyState title="Sin preguntas" description="Agregá la primera." /> : (
        <Table>
          <THead><tr><TH className="w-10">#</TH><TH>Lo que dice la máquina</TH><TH>Tipo</TH><TH>Respuesta</TH><TH className="w-40"><span className="sr-only">Acciones</span></TH></tr></THead>
          <tbody>
            {items.map((i, idx) => {
              const k = statusOf('item', i.kind);
              return (
                <TR key={i.id}>
                  <TD className={cn('tabular align-top pt-3', !i.enabled && 'text-fg-3')}>{i.position}</TD>
                  <TD className={cn('py-2.5 align-top', !i.enabled && 'opacity-50')}>
                    {section === 'rafaga' ? (
                      <div className="flex items-center gap-3">
                        {i.media_url && (/\.(mp4|webm|mov|m4v)($|\?)/i.test(i.media_url)
                          ? <video src={i.media_url} className="size-12 rounded object-cover" muted playsInline />
                          // eslint-disable-next-line @next/next/no-img-element
                          : <img src={i.media_url} alt="" className="size-12 rounded object-cover" />)}
                        <div>
                          <div className="max-w-xl text-base font-medium text-fg">{i.screen_text}</div>
                          <div className="mt-0.5 text-lg">{i.emoji_a} <span className="text-sm text-fg-3">o</span> {i.emoji_b}{i.kind === 'trap' && <span className="ml-2 text-sm text-fg-3">correcto: {i.correct === 'a' ? i.emoji_a : i.emoji_b}</span>}</div>
                          {i.echo && <div className="mt-0.5 text-sm text-fg-2">↻ Vuelve por voz: “{i.prompt}”</div>}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="max-w-xl text-base text-fg">{i.screen_text ?? i.prompt}</div>
                        {i.screen_text && <div className="mt-0.5 max-w-xl text-sm text-fg-3">“{i.prompt}”</div>}
                      </>
                    )}
                    {i.option_a && <div className="mt-1 text-sm text-fg-2">A · {i.option_a} &nbsp;/&nbsp; B · {i.option_b}</div>}
                    {i.follow_up && <div className="mt-1 text-sm text-fg-2">↳ Repregunta: {i.follow_up}</div>}
                    {i.source_note && <div className="mt-1 text-xs text-fg-3">Fuente: {i.source_note}</div>}
                    {!i.enabled && <div className="mt-1 text-xs font-medium text-warning">Apagada: no sale en partidas nuevas</div>}
                  </TD>
                  <TD className="align-top pt-2.5"><Badge tone={k.tone}>{k.label}</Badge>{code(i.subthesis_id) && <span className="ml-1.5 font-mono text-xs text-fg-3">{code(i.subthesis_id)}</span>}</TD>
                  <TD muted className="align-top pt-3 text-sm">{section === 'rafaga' ? (i.echo ? `Toque + ${ANSWER[i.answer_type]?.toLowerCase()}` : 'Toque') : ANSWER[i.answer_type] ?? i.answer_type}</TD>
                  <TD className="align-top pt-1.5">
                    <ItemActions item={i} first={idx === 0} last={idx === items.length - 1} experimentId={experimentId} subtheses={subtheses} />
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

const ANSWER: Record<string, string> = { choice: 'Dilema A / B', yes_no: 'Sí / no', agree: 'De acuerdo / no', number: 'Número', open: 'Libre' };
