import Link from 'next/link';
import { Download } from 'lucide-react';
import { loadInstrument, appLabel } from '@/lib/results-data';
import { CUTS, signalPairs, summarize, type Block, type Cut } from '@/lib/results';
import { fmt, cn } from '@/lib/utils';
import { Badge, Card, CardHeader, EmptyState, ErrorNotice, PageHeader, Stat } from '@/components/ui/primitives';
import { ReportsPanel } from './reports';
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

function BlockCard({ b, index, cut }: { b: Block; index: number; cut: Cut }) {
  const groups = b.groups.filter((g) => g.n > 0);
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs text-fg-3">{index} · {b.subtitle ?? b.format ?? b.kind}</div>
          <div className="mt-0.5 whitespace-pre-line font-medium">{b.title}</div>
        </div>
        <div className="shrink-0 text-right text-sm text-fg-3">
          <div className="tabular">{fmt.n(b.n)} respuestas</div>
          {b.lied > 0 && <div className="tabular text-warning">{fmt.n(b.lied)} mintieron</div>}
          {b.mean != null && <div className="tabular">Promedio {b.mean}</div>}
        </div>
      </div>
      <div className="p-4">
        {cut === 'none' || groups.length <= 1 ? (
          <ul className="flex flex-col gap-2">
            {b.rows.map((r) => (
              <li key={r.label} className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate" title={r.label}>{r.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-fg-2" style={{ width: `${r.pct}%` }} /></div>
                <span className="tabular w-40 text-right">{fmt.pct(r.pct)} <span className="text-fg-3">· {fmt.n(r.n)}{r.medianMs != null ? ` · ${(r.medianMs / 1000).toFixed(1)} s` : ''}</span></span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-fg-3"><th className="py-1 pr-3 font-medium">Respuesta</th><th className="py-1 pr-3 text-right font-medium">Total</th>{groups.map((g) => <th key={g.name} className="py-1 pr-3 text-right font-medium">{g.name}<div className="text-xs font-normal">n={g.n}</div></th>)}</tr></thead>
              <tbody>
                {b.rows.map((r) => {
                  const vals = groups.map((g) => r.byGroup[g.name]?.pct ?? 0);
                  const hi = Math.max(...vals), lo = Math.min(...vals);
                  return (
                    <tr key={r.label} className="border-t border-border">
                      <td className="py-1.5 pr-3">{r.label}</td>
                      <td className="tabular py-1.5 pr-3 text-right">{fmt.pct(r.pct)}</td>
                      {groups.map((g, i) => (
                        <td key={g.name} className={cn('tabular py-1.5 pr-3 text-right', hi - lo >= 20 && vals[i] === hi && 'font-semibold text-fg', hi - lo >= 20 && vals[i] === lo && 'text-fg-3')}>
                          {fmt.pct(r.byGroup[g.name]?.pct ?? 0)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-fg-3">En negrita, el grupo que más se separa cuando la diferencia es de 20 puntos o más. Con pocos nodos por grupo, es solo una pista.</p>
          </div>
        )}
        {b.statedVsTruth && (
          <div className="mt-3 rounded bg-sunken p-3 text-sm">
            <div className="mb-1 font-medium">Lo que dijeron vs. lo que es</div>
            <ul className="flex flex-col gap-0.5">
              {b.statedVsTruth.map((s) => <li key={s.label} className="flex justify-between"><span>{s.label}</span><span className="tabular text-fg-3">dijeron {fmt.n(s.stated)} · en verdad {fmt.n(s.truth)}</span></li>)}
            </ul>
          </div>
        )}
        {b.transcripts && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-fg-2">Lo que dijeron ({b.transcripts.length})</summary>
            <ul className="mt-2 flex flex-col gap-1 text-fg-2">{b.transcripts.map((t, i) => <li key={i}>“{t}”</li>)}</ul>
          </details>
        )}
      </div>
    </Card>
  );
}
