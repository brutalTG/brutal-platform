import { Plus, Library } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { Badge, Card, EmptyState, ErrorNotice, PageHeader, Table, TD, TH, THead, TR, Tabs } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/form';
import { QuestionDialog, type QuestionRow } from '@/components/amigos/question-form';
import { promoteQuestion, setQuestionStatus } from '@/lib/amigos-actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Preguntas · Amigos de mierda' };

const statusTone = { draft: 'neutral', active: 'success', retired: 'neutral' } as const;
const statusLabel = { draft: 'Borrador', active: 'Activa', retired: 'Retirada' } as const;

export default async function PreguntasPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo = 'house' } = await searchParams;
  const kind = ['house', 'national', 'player'].includes(tipo) ? tipo : 'house';
  const [qQ, counts, stQ] = await Promise.all([
    from('amigos', 'questions').select('*').eq('origin', kind).order(kind === 'national' ? 'scheduled_for' : 'created_at', { ascending: kind === 'national' }).limit(500),
    from('amigos', 'questions').select('origin'),
    from('signal', 'subtheses').select('id, code, statement, studies(name)').order('position'),
  ]);
  const error = explain(qQ.error);
  if (error) return (<><PageHeader title="Preguntas" /><ErrorNotice message={error} /></>);
  const rows = (qQ.data ?? []) as QuestionRow[];
  const count = (o: string) => ((counts.data ?? []) as { origin: string }[]).filter((x) => x.origin === o).length;
  const subtheses = ((stQ.data ?? []) as any[]).map((s) => ({ id: s.id, label: `${s.studies?.name ?? 'Estudio'} · ${s.code}: ${String(s.statement).slice(0, 60)}` }));

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/amigos', label: 'Amigos de mierda' }]}
        title="Preguntas"
        description="La biblioteca que el bot sugiere, las nacionales (iguales para todos los grupos un día) y las que escriben los jugadores. Las que se eligen suben; las que nadie elige se retiran."
        actions={<QuestionDialog subtheses={subtheses} trigger={<Button variant="primary" icon={<Plus />}>Nueva pregunta</Button>} />}
      />
      <Tabs active={kind} items={[
        { key: 'house', label: 'Biblioteca', href: '/amigos/preguntas?tipo=house', count: count('house') },
        { key: 'national', label: 'Nacionales', href: '/amigos/preguntas?tipo=national', count: count('national') },
        { key: 'player', label: 'De jugadores', href: '/amigos/preguntas?tipo=player', count: count('player') },
      ]} />
      <Card>
        {rows.length === 0 ? <EmptyState icon={<Library />} title="No hay preguntas acá" description={kind === 'player' ? 'Cuando alguien escriba su propio dilema en su turno, aparece acá.' : 'Creá la primera con «Nueva pregunta».'} /> : (
          <Table>
            <THead><tr><TH>Dilema</TH><TH>Opciones</TH>{kind === 'national' ? <TH>Fecha</TH> : <TH>Estado</TH>}<TH align="right">Ofrecida</TH><TH align="right">Elegida</TH><TH align="right">Tasa</TH><TH /></tr></THead>
            <tbody>
              {rows.map((q) => (
                <TR key={q.id}>
                  <TD className="max-w-md">
                    <div className="line-clamp-2 font-medium text-fg">{q.prompt}</div>
                    {q.detail && <div className="line-clamp-1 text-xs text-fg-3">{q.detail}</div>}
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {q.tone === 'signal' && <Badge tone="info" dot={false}>señal</Badge>}
                      {q.tags.map((t) => <Badge key={t} dot={false}>{t}</Badge>)}
                    </div>
                  </TD>
                  <TD className="text-sm"><div>A · {q.option_a}</div><div>B · {q.option_b}</div></TD>
                  {kind === 'national' ? <TD>{fmt.date(q.scheduled_for)}</TD> : <TD><Badge tone={statusTone[q.status as keyof typeof statusTone]}>{statusLabel[q.status as keyof typeof statusLabel]}</Badge></TD>}
                  <TD align="right">{fmt.n(q.offered)}</TD>
                  <TD align="right">{fmt.n(q.picked)}</TD>
                  <TD align="right">{q.offered ? fmt.pct((100 * q.picked) / q.offered) : '—'}</TD>
                  <TD align="right">
                    <div className="flex justify-end gap-1.5">
                      {kind === 'player' ? (
                        <ActionButton size="sm" action={promoteQuestion.bind(null, q.id)}>A la biblioteca</ActionButton>
                      ) : (
                        <>
                          <QuestionDialog q={q} subtheses={subtheses} trigger={<Button size="sm">Editar</Button>} />
                          {q.status !== 'active'
                            ? <ActionButton size="sm" action={setQuestionStatus.bind(null, q.id, 'active')}>Activar</ActionButton>
                            : <ActionButton size="sm" variant="ghost" action={setQuestionStatus.bind(null, q.id, 'retired')}>Retirar</ActionButton>}
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
