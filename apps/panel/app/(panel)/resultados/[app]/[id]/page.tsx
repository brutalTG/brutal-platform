import Link from 'next/link';
import { Download } from 'lucide-react';
import { loadInstrument, appLabel } from '@/lib/results-data';
import { CUTS, signalPairs, summarize, type Cut } from '@/lib/results';
import { fmt, cn } from '@/lib/utils';
import { Badge, Card, CardHeader, EmptyState, ErrorNotice, PageHeader, Stat } from '@/components/ui/primitives';
import { ReportsPanel } from './reports';
import { BlockCard } from '@/components/results/block-card';
import { listReportsFor } from '@/lib/reports-actions';

export const maxDuration = 300;

export const dynamic = 'force-dynamic';

type SP = { corte?: string; trampas?: string; archivados?: string; mentiras?: string };

export default async function InstrumentResults({ params, searchParams }: { params: Promise<{ app: string; id: string }>; searchParams: Promise<SP> }) {
  const { app, id: raw } = await params;
  const id = decodeURIComponent(raw);
  const sp = await searchParams;
  const cut = (CUTS.some((c) => c.value === sp.corte) ? sp.corte : 'none') as Cut;
  const opt = { cut, includeTrapFailed: sp.trampas === '1', includeArchived: sp.archivados === '1', includeLies: sp.mentiras === '1' };

  let data: Awaited<ReturnType<typeof loadInstrument>>;
  try { data = await loadInstrument(app, id); } catch (e) { return <ErrorNotice message={e instanceof Error ? e.message : 'Error'} />; }
  const { obs, facts, meta, name, study } = data;
  const blocks = summarize(obs, facts, meta, opt);
  const reports = await listReportsFor(app, id);
  const pairs = signalPairs(obs, facts, meta, opt);
  const counted = obs.filter((o) => !o.context?.test && (opt.includeArchived || facts.get(o.pseudonym_id)?.status !== 'archived'));
  const nodes = new Set(counted.map((o) => o.pseudonym_id)).size;
  const minors = [...new Set(counted.map((o) => o.pseudonym_id))].filter((p) => facts.get(p)?.is_minor).length;
  const traps = counted.filter((o) => o.quality === 'trap_failed').length;
  const lies = counted.filter((o) => o.quality === 'declared_lie').length;

  const q = (patch: Partial<SP>) => {
    const next = { ...sp, ...patch };
    const s = new URLSearchParams(Object.entries(next).filter(([, v]) => v && v !== 'none' && v !== '0') as [string, string][]).toString();
    return `/resultados/${app}/${encodeURIComponent(id)}${s ? `?${s}` : ''}`;
  };
  const toggle = (k: keyof SP, label: string) => (
    <Link href={q({ [k]: sp[k] === '1' ? '0' : '1' })} className={cn('rounded border px-2 py-1 text-sm', sp[k] === '1' ? 'border-fg bg-fg text-bg' : 'border-border text-fg-2 hover:bg-sunken')}>{label}</Link>
  );

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/resultados', label: 'Resultados' }]}
        title={name}
        meta={<><Badge dot={false}>{appLabel(app)}</Badge>{study && <Link href={`/estudios/${encodeURIComponent(study.slug)}`} className="text-sm text-fg-3 hover:underline">{study.name}</Link>}</>}
        actions={<a href={`/resultados/${app}/${encodeURIComponent(id)}/csv${opt.includeArchived ? '?archivados=1' : ''}`} className="inline-flex h-8 items-center gap-1.5 rounded border border-border-strong bg-surface px-3 text-sm hover:bg-sunken"><Download className="size-4" /> Descargar planilla</a>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nodos" value={fmt.n(nodes)} hint={minors ? `${fmt.n(minors)} menores` : undefined} />
        <Stat label="Respuestas" value={fmt.n(counted.length)} />
        <Stat label="Trampas falladas" value={fmt.n(traps)} tone={traps ? 'warning' : undefined} hint={opt.includeTrapFailed ? 'Incluidas en los números' : 'Fuera de los números'} />
        <Stat label="Mentiras declaradas" value={fmt.n(lies)} hint={app === 'pressure' ? 'En binarias se cuenta la verdad' : undefined} />
      </div>

      <ReportsPanel app={app} instrumentId={id} hasStudy={Boolean(study)} hasData={counted.length > 0} reports={reports} />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-fg-3">Cortar por</span>
        {CUTS.map((c) => (
          <Link key={c.value} href={q({ corte: c.value })} className={cn('rounded border px-2 py-1 text-sm', cut === c.value ? 'border-fg bg-fg text-bg' : 'border-border text-fg-2 hover:bg-sunken')}>{c.label}</Link>
        ))}
        <span className="mx-2 h-5 w-px bg-border" />
        {toggle('trampas', 'Con trampas falladas')}
        {toggle('archivados', 'Con nodos archivados')}
        {app === 'pressure' && toggle('mentiras', 'Con mentiras sin verdad')}
      </div>

      {blocks.length === 0 ? (
        <Card className="mt-4"><EmptyState title="Sin respuestas para mostrar" description="Probá sumar los nodos archivados o las trampas falladas." /></Card>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {blocks.map((b, i) => <BlockCard key={b.key} b={b} index={i + 1} cut={cut} />)}
        </div>
      )}

      {pairs.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Pares de señal" description="La misma persona en las dos cartas del par: si se contradice, la primera respuesta fue de vidriera." />
          <div className="grid gap-4 p-4 md:grid-cols-2">
            {pairs.map((p) => (
              <div key={p.pair} className="rounded border border-border p-3">
                <div className="text-sm font-medium">{p.pair}</div>
                <div className="mt-1 text-xs text-fg-3">{p.explorer} → {p.validator} · {fmt.n(p.both)} respondieron las dos</div>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {p.table.map((c) => <li key={c.a + c.b} className="flex justify-between gap-2"><span>{c.a} → {c.b}</span><span className="tabular text-fg-3">{fmt.n(c.n)}</span></li>)}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
