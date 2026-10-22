import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, CardBody, CardHeader, DL, ErrorNotice, PageHeader, Table, TD, TH, THead, TR } from '@/components/ui/primitives';
import { panelEnv, envLabel } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sistema' };

const kindLabel: Record<string, string> = {
  choice: 'Elección', ranking: 'Orden', scale: 'Escala', text: 'Texto', voice: 'Voz', game_move: 'Jugada', behavior: 'Comportamiento', declared: 'Declarado',
};

export default async function SistemaPage() {
  const { data, error } = await from('core', 'apps').select('*').order('name');
  const env = panelEnv();
  return (
    <>
      <PageHeader title="Sistema" description="Webapps registradas, qué entrega cada una y en qué entorno estás." />
      <Card className="mb-6">
        <CardHeader title="Entorno" />
        <CardBody>
          <DL items={[
            { label: 'Entorno', value: <Badge tone={env === 'test' ? 'warning' : 'success'}>{envLabel[env]}</Badge> },
            { label: 'Base de datos', value: env === 'test' ? 'brutal-sandbox' : 'brutal-production' },
            { label: 'Versión del panel', value: <span className="font-mono text-sm">{(process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)}</span> },
            { label: 'Rama', value: process.env.VERCEL_GIT_COMMIT_REF ?? '—' },
          ]} />
        </CardBody>
      </Card>
      {error ? <ErrorNotice message={explain(error)!} /> : (
        <Card>
          <CardHeader title="Webapps" description="Cada app declara los tipos de observación que entrega. Una app nueva se suma acá." />
          <Table>
            <THead><tr><TH>App</TH><TH>Estado</TH><TH>Producción</TH><TH>Test</TH><TH>Entrega</TH><TH>Alta</TH></tr></THead>
            <tbody>
              {(data ?? []).map((a) => {
                const s = statusOf('app', a.status);
                return (
                  <TR key={a.slug}>
                    <TD><div className="font-medium">{a.name}</div><div className="text-xs text-fg-3">{a.description}</div></TD>
                    <TD><Badge tone={s.tone}>{s.label}</Badge></TD>
                    <TD className="font-mono text-sm">{a.prod_domain ?? '—'}</TD>
                    <TD className="font-mono text-sm">{a.test_domain ?? '—'}</TD>
                    <TD><div className="flex max-w-xs flex-wrap gap-1">{(a.observation_kinds as string[]).map((k) => <Badge key={k} dot={false}>{kindLabel[k] ?? k}</Badge>)}</div></TD>
                    <TD muted>{fmt.date(a.created_at)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
