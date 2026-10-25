import { notFound } from 'next/navigation';
import { from } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Table, TD, TH, THead, TR } from '@/components/ui/primitives';
import { LaunchForm } from './form';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const metadata = { title: 'Mandar experimento' };

export default async function LaunchPage({ searchParams }: { searchParams: Promise<{ drop?: string }> }) {
  const { drop } = await searchParams;
  if (!drop || !/^[a-z0-9-]{3,80}$/.test(drop)) notFound();
  const { data: d } = await from('drops', 'drops').select('id, name, slug, status').eq('slug', drop).maybeSingle();
  if (!d) notFound();
  const x: any = d;
  const [{ data: campaigns }, { data: facts }] = await Promise.all([
    from('messaging', 'campaigns').select('id, name, status, audience_count, sent_count, failed_count, created_at, target').eq('app_slug', 'drops').order('created_at', { ascending: false }).limit(50),
    from('core', 'node_facts').select('gender, province').limit(5000),
  ]);
  const mine = (campaigns ?? []).filter((c: any) => c.target?.drop === drop);
  const genders = [...new Set((facts ?? []).map((f: any) => f.gender).filter(Boolean))].sort() as string[];
  const provinces = [...new Set((facts ?? []).map((f: any) => f.province).filter(Boolean))].sort() as string[];
  const st = statusOf('drop', x.status);
  return (
    <>
      <PageHeader crumbs={[{ href: `/experimentos?abrir=${x.id}`, label: x.name }]} title="Mandar por WhatsApp" meta={<Badge tone={st.tone}>{st.label}</Badge>}
        description="Elegí a quién le llega. Cada uno recibe su link personal; si todavía no armó su perfil, primero pasa por el onboarding y después entra directo. Nunca les llega a los que se dieron de baja, a los bloqueados ni a los que ya lo jugaron." />
      <LaunchForm drop={drop} live={x.status === 'live'} genders={genders} provinces={provinces} />
      <Card className="mt-6">
        <CardHeader title="Envíos anteriores" />
        {mine.length === 0 ? <EmptyState title="Todavía no se mandó" /> : (
          <Table>
            <THead><tr><TH>Cuándo</TH><TH align="right">A quiénes</TH><TH align="right">Salieron</TH><TH align="right">Fallaron</TH></tr></THead>
            <tbody>
              {mine.map((c: any) => (
                <TR key={c.id}><TD>{fmt.datetime(c.created_at)}</TD><TD align="right">{fmt.n(c.audience_count)}</TD><TD align="right">{fmt.n(c.sent_count)}</TD><TD align="right">{fmt.n(c.failed_count)}</TD></TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
