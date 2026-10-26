import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt, cn } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, EmptyState, ErrorNotice, PageHeader } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bitácora' };

const tabs = [
  { key: '', label: 'Todo' },
  { key: 'claude', label: 'Claude' },
  { key: 'admin', label: 'Equipo' },
  { key: 'system', label: 'Sistema' },
];

export default async function BitacoraPage({ searchParams }: { searchParams: Promise<{ actor?: string }> }) {
  const { actor = '' } = await searchParams;
  let q = from('core', 'audit_log').select('*').order('created_at', { ascending: false }).limit(100);
  if (actor) q = q.eq('actor_type', actor);
  const { data, error } = await q;

  return (
    <>
      <PageHeader title="Bitácora" description="Todo lo que hizo o propuso la inteligencia, el equipo y el sistema. Nada pasa sin quedar acá." />
      <nav aria-label="Filtrar por actor" className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key ? `/bitacora?actor=${t.key}` : '/bitacora'}
            aria-current={actor === t.key ? 'page' : undefined}
            className={cn('-mb-px border-b-2 px-3 py-2 text-base', actor === t.key ? 'border-fg font-medium text-fg' : 'border-transparent text-fg-3 hover:text-fg')}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {error ? <ErrorNotice message={explain(error)!} /> : (
        <Card>
          {(data ?? []).length === 0 ? <EmptyState icon={<ScrollText />} title="Sin movimientos" /> : (
            <ol className="divide-y divide-border">
              {(data ?? []).map((e) => {
                const a = statusOf('actor', e.actor_type);
                return (
                  <li key={e.id} className="flex gap-4 px-4 py-3">
                    <div className="w-28 shrink-0 pt-0.5 text-sm text-fg-3">{fmt.datetime(e.created_at)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={a.tone} dot={false}>{a.label}</Badge>
                        <span className="font-medium">{e.action}</span>
                        {e.entity_type && <span className="text-sm text-fg-3">· {e.entity_type} {e.entity_id}</span>}
                      </div>
                      {e.details?.summary && <p className="mt-1 text-base text-fg-2">{e.details.summary}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      )}
    </>
  );
}
