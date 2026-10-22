import { MessageSquare } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, CardHeader, EmptyState, ErrorNotice, PageHeader, Table, TD, TH, THead, TR } from '@/components/ui/primitives';
import { panelEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mensajes' };

export default async function MensajesPage() {
  const [tQ, mQ] = await Promise.all([
    from('messaging', 'templates').select('*').order('status'),
    from('messaging', 'messages').select('id, direction, purpose, command, status, created_at, template_key').order('created_at', { ascending: false }).limit(25),
  ]);
  const error = explain(tQ.error) ?? explain(mQ.error);
  if (error) return (<><PageHeader title="Mensajes" /><ErrorNotice message={error} /></>);

  return (
    <>
      <PageHeader
        title="Mensajes"
        description="WhatsApp: plantillas, envíos y conversaciones."
        meta={panelEnv() === 'test' ? <Badge tone="warning">Test: los envíos se simulan, no salen mensajes reales</Badge> : undefined}
      />
      <Card>
        <CardHeader title="Plantillas" description="El estado lo define Meta. Sin plantilla aprobada no sale ningún mensaje." />
        {(tQ.data ?? []).length === 0 ? <EmptyState icon={<MessageSquare />} title="Sin plantillas" /> : (
          <Table>
            <THead><tr><TH>Plantilla</TH><TH>Para qué</TH><TH>Texto</TH><TH>Estado</TH><TH>Actualizada</TH></tr></THead>
            <tbody>
              {(tQ.data ?? []).map((t) => {
                const s = statusOf('template', t.status);
                return (
                  <TR key={t.key}>
                    <TD className="font-mono text-sm">{t.provider_name}</TD>
                    <TD>{t.purpose}</TD>
                    <TD muted><span className="line-clamp-1 max-w-xs">{t.body}</span></TD>
                    <TD><Badge tone={s.tone}>{s.label}</Badge></TD>
                    <TD muted>{fmt.ago(t.updated_at)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <Card className="mt-6">
        <CardHeader title="Actividad reciente" />
        {(mQ.data ?? []).length === 0 ? <EmptyState title="Sin mensajes todavía" description="Los envíos y las respuestas de los nodos aparecen acá." /> : (
          <Table>
            <THead><tr><TH>Cuándo</TH><TH>Dirección</TH><TH>Para qué</TH><TH>Estado</TH></tr></THead>
            <tbody>
              {(mQ.data ?? []).map((m) => (
                <TR key={m.id}><TD muted>{fmt.datetime(m.created_at)}</TD><TD>{m.direction === 'in' ? 'Recibido' : 'Enviado'}</TD><TD>{m.purpose ?? m.command ?? '—'}</TD><TD>{m.status}</TD></TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
