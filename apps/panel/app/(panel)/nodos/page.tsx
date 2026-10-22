import { Users } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { nodeStatuses, statusOf } from '@/lib/status';
import { Badge, Card, EmptyState, ErrorNotice, PageHeader, RowLink, Table, TD, TH, THead, TR } from '@/components/ui/primitives';
import { FilterBar, Pagination, SearchInput, SelectFilter } from '@/components/ui/filters';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Nodos' };

const PAGE = 25;
const provinces = ['CABA', 'Buenos Aires', 'Córdoba', 'Santa Fe', 'Mendoza', 'Tucumán'].map((p) => ({ value: p, label: p }));

export default async function NodosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina ?? 1) || 1);
  let q = from('core', 'node_overview').select('*', { count: 'exact' });
  if (sp.estado) q = q.eq('status', sp.estado);
  if (sp.provincia) q = q.eq('province', sp.provincia);
  if (sp.q) {
    const term = sp.q.replace(/[%,()]/g, '');
    q = q.or(`nickname.ilike.%${term}%,phone_e164.ilike.%${term}%,city.ilike.%${term}%`);
  }
  const { data, count, error } = await q.order('last_active_at', { ascending: false, nullsFirst: false }).range((page - 1) * PAGE, page * PAGE - 1);

  return (
    <>
      <PageHeader
        title="Nodos"
        description="Lo único permanente de BRUTAL. Cada nodo suma lo que hace en todas las webapps."
      />
      {error ? <ErrorNotice message={explain(error)!} /> : (
        <Card>
          <FilterBar action="/nodos">
            <SearchInput name="q" defaultValue={sp.q} placeholder="Buscar por apodo, teléfono o ciudad" />
            <SelectFilter name="estado" label="Estado" defaultValue={sp.estado} options={nodeStatuses} />
            <SelectFilter name="provincia" label="Provincia" defaultValue={sp.provincia} options={provinces} />
          </FilterBar>
          {(data ?? []).length === 0 ? (
            <EmptyState icon={<Users />} title="Ningún nodo coincide" description="Probá con otros filtros o borrá la búsqueda." />
          ) : (
            <>
              <Table>
                <THead>
                  <tr>
                    <TH>Nodo</TH><TH>Estado</TH><TH align="right">Edad</TH><TH>Zona</TH>
                    <TH align="right">Drops</TH><TH align="right">Pressure</TH><TH align="right">Observaciones</TH><TH align="right">Tickets</TH><TH>Última actividad</TH>
                  </tr>
                </THead>
                <tbody>
                  {(data ?? []).map((n) => {
                    const s = statusOf('node', n.status);
                    return (
                      <TR key={n.id}>
                        <TD>
                          <RowLink href={`/nodos/${n.id}`}>{n.nickname ?? 'Sin apodo'}</RowLink>
                          <div className="tabular text-xs text-fg-3">{fmt.phone(n.phone_e164)}</div>
                        </TD>
                        <TD><Badge tone={s.tone}>{s.label}</Badge></TD>
                        <TD align="right">{n.age ?? '—'}{n.is_minor && <span className="ml-1 text-xs text-warning">menor</span>}</TD>
                        <TD muted>{[n.city, n.province].filter(Boolean).join(', ') || '—'}</TD>
                        <TD align="right">{fmt.n(n.drop_sessions)}</TD>
                        <TD align="right">{fmt.n(n.pressure_sessions)}</TD>
                        <TD align="right">{fmt.n(n.observations)}</TD>
                        <TD align="right">{fmt.n(n.tickets)}</TD>
                        <TD muted>{fmt.ago(n.last_active_at)}</TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination page={page} pageSize={PAGE} total={count ?? 0} base="/nodos" params={{ q: sp.q, estado: sp.estado, provincia: sp.provincia }} />
            </>
          )}
        </Card>
      )}
    </>
  );
}
