import { MessageSquare } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt, cn } from '@/lib/utils';
import { Badge, Card, CardHeader, EmptyState, ErrorNotice, PageHeader, Table, TD, TH, THead, TR } from '@/components/ui/primitives';
import { panelEnv } from '@/lib/env';
import { SimulateButton } from '@/components/forms/simulate';
import { TemplateButton } from '@/components/forms/template';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mensajes' };

type Msg = { id: string; contact_id: string; direction: 'in' | 'out'; purpose: string | null; status: string; body: string | null; created_at: string; error_message: string | null };

async function apiHealth() {
  const api = process.env.API_URL;
  if (!api) return null;
  try {
    const r = await fetch(`${api.replace(/\/+$/, '')}/health`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    return (await r.json()) as { ok: boolean; whatsapp: 'mock' | 'wati' | 'disabled'; missing: string[] };
  } catch { return null; }
}

export default async function MensajesPage() {
  const [tQ, mQ, cQ, health] = await Promise.all([
    from('messaging', 'templates').select('*').order('key'),
    from('messaging', 'messages').select('id, contact_id, direction, purpose, status, body, created_at, error_message').order('created_at', { ascending: false }).limit(200),
    from('messaging', 'contacts').select('id, phone_e164, node_id, opted_out_at, last_inbound_at').order('last_inbound_at', { ascending: false, nullsFirst: false }).limit(30),
    apiHealth(),
  ]);
  const error = explain(tQ.error) ?? explain(mQ.error) ?? explain(cQ.error);
  if (error) return (<><PageHeader title="Mensajes" /><ErrorNotice message={error} /></>);

  const msgs = (mQ.data ?? []) as Msg[];
  const contacts = (cQ.data ?? []) as { id: string; phone_e164: string; node_id: string | null; opted_out_at: string | null; last_inbound_at: string | null }[];
  const mode = health?.whatsapp;
  const test = panelEnv() === 'test';

  return (
    <>
      <PageHeader
        title="Mensajes"
        description="WhatsApp: lo que escriben los nodos y lo que responde el bot."
        meta={
          mode === 'wati' ? <Badge tone="success">Conectado a WATI: los mensajes son reales</Badge>
          : mode === 'mock' ? <Badge tone="warning">Simulado: el bot responde acá, no sale nada</Badge>
          : <Badge tone="danger">No pude consultar el estado del bot</Badge>
        }
        actions={test ? <SimulateButton realMode={mode === 'wati'} /> : undefined}
      />

      <Card>
        <CardHeader title="Conversaciones" description="Las 30 más recientes. El bot solo le responde a números invitados." />
        {contacts.length === 0 ? <EmptyState icon={<MessageSquare />} title="Nadie escribió todavía" description={test ? 'Usá “Simular mensaje” para probar el circuito sin un teléfono.' : 'Cuando un invitado escriba al número de BRUTAL, aparece acá.'} /> : (
          <ul className="divide-y divide-border">
            {contacts.map((c) => {
              const thread = msgs.filter((m) => m.contact_id === c.id).slice(0, 8).reverse();
              return (
                <li key={c.id} className="px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="tabular font-medium text-fg">{fmt.phone(c.phone_e164)}</span>
                    {c.node_id ? <Badge tone="success" dot={false}>Invitado</Badge> : <Badge tone="neutral" dot={false}>No invitado</Badge>}
                    {c.opted_out_at && <Badge tone="warning" dot={false}>Se dio de baja</Badge>}
                    <span className="text-fg-3">{fmt.ago(c.last_inbound_at)}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {thread.map((m) => (
                      <div key={m.id} className={cn('max-w-[min(520px,90%)] whitespace-pre-line rounded-md px-3 py-2 text-sm', m.direction === 'in' ? 'self-start bg-sunken text-fg' : 'self-end bg-info-bg text-fg')}>
                        {m.body ?? <span className="text-fg-3">({m.purpose})</span>}
                        <div className="mt-1 text-xs text-fg-3">{fmt.datetime(m.created_at)}{m.direction === 'out' && ` · ${m.status === 'failed' ? `falló: ${m.error_message ?? ''}` : m.status}`}</div>
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Textos del bot" description="Respuestas dentro de la conversación (no son plantillas de Meta). Las variables entre llaves se completan solas." />
        <Table>
          <THead><tr><TH>Mensaje</TH><TH>Texto</TH><TH>Actualizado</TH><TH className="w-12"><span className="sr-only">Editar</span></TH></tr></THead>
          <tbody>
            {(tQ.data ?? []).map((t) => (
              <TR key={t.key}>
                <TD className="align-top pt-2.5"><div className="font-medium">{t.purpose}</div><div className="font-mono text-xs text-fg-3">{t.key}</div></TD>
                <TD muted className="py-2.5"><span className="block max-w-xl whitespace-pre-line text-sm">{t.body}</span></TD>
                <TD muted className="align-top pt-2.5">{fmt.ago(t.updated_at)}</TD>
                <TD className="align-top pt-1.5"><TemplateButton k={t.key} purpose={t.purpose} body={t.body} /></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
