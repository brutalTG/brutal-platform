import Link from 'next/link';
import { Clock, Flame, MessagesSquare } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { panelEnv } from '@/lib/env';
import { normalizePhone } from '@/lib/phone';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorNotice, PageHeader, RowLink, Stat, Table, TD, TH, THead, TR } from '@/components/ui/primitives';
import { ActionButton } from '@/components/ui/form';
import { buttonVariants } from '@/components/ui/button';
import { Simulator } from '@/components/amigos/simulator';
import { Chat, type ChatMsg } from '@/components/amigos/chat';
import { runTick } from '@/lib/amigos-actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Amigos de mierda' };

type Health = { amigos?: { whatsapp: 'mock' | 'gateway' | 'disabled'; missing: string[] } };

async function apiHealth(): Promise<Health | null> {
  const api = process.env.API_URL;
  if (!api) return null;
  try {
    const r = await fetch(`${api.replace(/\/+$/, '')}/health`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    return (await r.json()) as Health;
  } catch { return null; }
}

const groupTone = { setup: 'info', active: 'success', paused: 'warning', finished: 'neutral' } as const;
const groupLabel = { setup: 'Armándose', active: 'En juego', paused: 'En pausa', finished: 'Terminó' } as const;

export default async function AmigosPage({ searchParams }: { searchParams: Promise<{ tel?: string }> }) {
  const { tel } = await searchParams;
  const test = panelEnv() === 'test';
  const phone = tel ? normalizePhone(tel) : null;
  const [gQ, health, players, answers, voices] = await Promise.all([
    from('amigos', 'group_overview').select('*').order('created_at', { ascending: false }).limit(200),
    apiHealth(),
    from('amigos', 'members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    from('amigos', 'answers').select('member_id', { count: 'exact', head: true }),
    from('amigos', 'voices').select('id', { count: 'exact', head: true }).eq('skipped', false),
  ]);
  const error = explain(gQ.error);
  if (error) return (<><PageHeader title="Amigos de mierda" /><ErrorNotice message={error} /></>);
  const groups = (gQ.data ?? []) as any[];

  let thread: ChatMsg[] = [];
  if (test && phone) {
    const { data: c } = await from('messaging', 'contacts').select('id').eq('phone_e164', phone).maybeSingle();
    if (c) {
      const { data } = await from('messaging', 'messages').select('id, direction, body, media_url, media_kind, status, created_at, error_message')
        .eq('contact_id', (c as { id: string }).id).like('purpose', 'amigos%').order('created_at', { ascending: false }).limit(60);
      thread = ((data ?? []) as ChatMsg[]).reverse();
    }
  }

  const mode = health?.amigos?.whatsapp;
  const missing = health?.amigos?.missing ?? [];

  return (
    <>
      <PageHeader
        title="Amigos de mierda"
        description="Un juego para gente que no quiere tanto a sus amigos. Una pregunta por día por WhatsApp; cada uno contesta y apuesta qué contestó cada amigo. Todo entra como señal al perfil del nodo."
        meta={
          <>
            {mode === 'gateway' ? <Badge tone="success">Conectado a su número: los mensajes son reales</Badge>
              : mode === 'mock' ? <Badge tone="warning">Simulado: el bot responde acá, no sale nada</Badge>
              : mode === 'disabled' ? <Badge tone="danger">WhatsApp del juego apagado</Badge>
              : <Badge tone="danger">No pude consultar el estado del API</Badge>}
            {missing.length > 0 && <Badge tone="warning">Falta configurar: {missing.join(', ')}</Badge>}
          </>
        }
        actions={
          <>
            <Link href="/amigos/preguntas" className={buttonVariants({ variant: 'secondary' })}>Preguntas</Link>
            <ActionButton variant="secondary" icon={<Clock />} action={runTick}>Correr el reloj</ActionButton>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Grupos" value={fmt.n(groups.length)} hint={`${groups.filter((g) => g.status === 'active').length} en juego`} />
        <Stat label="Jugadores activos" value={fmt.n(players.count ?? 0)} />
        <Stat label="Respuestas" value={fmt.n(answers.count ?? 0)} />
        <Stat label="Audios" value={fmt.n(voices.count ?? 0)} />
      </div>

      {test && (
        <Card className="mb-6">
          <CardHeader title="Probar el juego" description="Escribile al bot como si fueras otra persona. Usá un número inventado por jugador (ej. 11 0000 0001, 11 0000 0002)." />
          <CardBody className="flex flex-col gap-4">
            <Simulator initialPhone={phone ?? ''} />
            {phone && (thread.length ? <Chat messages={thread} /> : <p className="text-sm text-fg-3">Todavía no hay conversación con ese número.</p>)}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Grupos" description="Cada grupo lo arma alguien desde su WhatsApp y suma a sus amigos con un link." />
        {groups.length === 0 ? (
          <EmptyState icon={<Flame />} title="Ningún grupo todavía" description={test ? 'Arrancá uno desde “Probar el juego” escribiendo “Quiero jugar con mi grupo”.' : 'Cuando alguien escriba al número del juego, aparece acá.'} />
        ) : (
          <Table>
            <THead><tr><TH>Grupo</TH><TH>Estado</TH><TH align="right">Día</TH><TH align="right">Activos</TH><TH align="right">Sin entrar</TH><TH align="right">Respuestas</TH><TH align="right">Audios</TH><TH>Última respuesta</TH></tr></THead>
            <tbody>
              {groups.map((g) => (
                <TR key={g.id}>
                  <TD>
                    <RowLink href={`/amigos/${g.id}`}>{g.name}</RowLink>
                    <div className="text-xs text-fg-3">#{g.number} · código {g.code}{g.test ? ' · prueba' : ''}</div>
                  </TD>
                  <TD><Badge tone={groupTone[g.status as keyof typeof groupTone]}>{groupLabel[g.status as keyof typeof groupLabel]}</Badge></TD>
                  <TD align="right">{g.day ? `${g.day} de ${g.season_days}` : '—'}</TD>
                  <TD align="right">{fmt.n(g.active_members)}</TD>
                  <TD align="right" muted>{fmt.n(g.listed_members)}</TD>
                  <TD align="right">{fmt.n(g.answers)}</TD>
                  <TD align="right">{fmt.n(g.voices)}</TD>
                  <TD muted>{fmt.ago(g.last_answer_at)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {!test && (
        <p className="mt-4 flex items-center gap-2 text-sm text-fg-3"><MessagesSquare className="size-4" aria-hidden />Las conversaciones completas están en Mensajes.</p>
      )}
    </>
  );
}
