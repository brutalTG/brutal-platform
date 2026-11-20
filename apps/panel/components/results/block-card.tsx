import { type Block, type Cut, type View } from '@/lib/results';
import { fmt, cn } from '@/lib/utils';
import { Card } from '@/components/ui/primitives';

const KIND: Record<string, string> = {
  Toque: 'Ráfaga · toque', Repregunta: 'Repregunta por voz', rafaga: 'Vuelta por voz', game: 'Pregunta por voz', calibration: 'Calibración',
  choice: 'Elegir', choice_emoji: 'Elegir emoji', choice_hybrid: 'Elegir mixto', slider: 'Escala', slider_emoji: 'Escala emoji', confesionario: 'Confesionario',
  prediction_bet: 'Apuesta', ranking: 'Ordenar', binary_media: 'Imagen A/B', rafaga_emoji: 'Ráfaga', rafaga_burst: 'Ráfaga', hot_take: 'Hot take',
  hot_take_visual: 'Hot take', trap: 'Trampa', trap_silent: 'Trampa silenciosa', dead_drop: 'Dead drop', media_reaction: 'Reacción a imagen',
  voice: 'Pregunta por voz', mayor_menor: 'Mayor o menor', game_move: 'Juego', declared: 'Calibración', market: 'Predicción',
};
const kindLabel = (b: Block) => (b.subtitle && KIND[b.subtitle]) || b.subtitle || KIND[b.format ?? ''] || KIND[b.kind] || b.format || b.kind;

export function BlockCard({ b, index, cut }: { b: Block; index: number; cut: Cut }) {
  const groups = b.groups.filter((g) => g.n > 0);
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs text-fg-3">{index} · {kindLabel(b)}</div>
          <div className="mt-0.5 whitespace-pre-line font-medium">{b.title}</div>
        </div>
        <div className="shrink-0 text-right text-sm text-fg-3">
          <div className="tabular">{fmt.n(b.n)} respuestas</div>
          {b.lied > 0 && <div className="tabular text-warning">{fmt.n(b.lied)} mintieron</div>}
          {b.mean != null && !b.view && <div className="tabular">Promedio {b.mean}</div>}
        </div>
      </div>
      <div className="p-4">
        {b.view ? <ViewBody v={b.view} groups={cut === 'none' ? [] : groups} /> : cut === 'none' || groups.length <= 1 ? (
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

type G = { name: string; n: number }[];
const sec = (ms: number | null) => (ms == null ? '' : `${(ms / 1000).toFixed(1)} s`);
const num = (x: number) => x.toLocaleString('es-AR', { maximumFractionDigits: 1 });

function ViewBody({ v, groups }: { v: View; groups: G }) {
  const cut = groups.length > 1;
  if (v.type === 'ranking') return cut ? <RankingByGroup v={v} groups={groups} /> : <Ranking v={v} />;
  if (v.type === 'split') return cut ? <SplitByGroup v={v} groups={groups} /> : <Split v={v} />;
  if (v.type === 'scale') return <Scale v={v} groups={cut ? groups : []} />;
  return <Market v={v} />;
}

function Ranking({ v }: { v: Extract<View, { type: 'ranking' }> }) {
  return (
    <div>
      <div className="mb-2 grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_3.5rem_3.5rem] gap-3 text-xs text-fg-3">
        <span /><span>Opción</span><span>Posición promedio (1 = arriba)</span><span className="text-right">1° lugar</span><span className="text-right">Último</span>
      </div>
      <ol className="flex flex-col gap-2">
        {v.items.map((it, i) => (
          <li key={it.label} className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_3.5rem_3.5rem] items-center gap-3 text-sm">
            <span className="tabular text-fg-3">{i + 1}</span>
            <span className="truncate font-medium" title={it.label}>{it.label}</span>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-fg-2" style={{ width: `${v.size > 1 ? ((v.size - it.avgPos) / (v.size - 1)) * 100 : 100}%` }} /></div>
              <span className="tabular w-8 text-right">{num(it.avgPos)}</span>
            </div>
            <span className="tabular text-right">{fmt.pct(it.firstPct)}</span>
            <span className="tabular text-right text-fg-3">{fmt.pct(it.lastPct)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RankingByGroup({ v, groups }: { v: Extract<View, { type: 'ranking' }>; groups: G }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-fg-3"><th className="py-1 pr-3 font-medium">Opción</th><th className="py-1 pr-3 text-right font-medium">Todos</th>{groups.map((g) => <th key={g.name} className="py-1 pr-3 text-right font-medium">{g.name}<div className="text-xs font-normal">n={g.n}</div></th>)}</tr></thead>
        <tbody>
          {v.items.map((it) => {
            const vals = groups.map((g) => it.byGroup[g.name]).filter((x): x is number => x != null);
            const best = Math.min(...vals), worst = Math.max(...vals);
            return (
              <tr key={it.label} className="border-t border-border">
                <td className="py-1.5 pr-3">{it.label}</td>
                <td className="tabular py-1.5 pr-3 text-right">{num(it.avgPos)}</td>
                {groups.map((g) => {
                  const x = it.byGroup[g.name];
                  return <td key={g.name} className={cn('tabular py-1.5 pr-3 text-right', worst - best >= 1.5 && x === best && 'font-semibold text-fg', worst - best >= 1.5 && x === worst && 'text-fg-3')}>{x == null ? '—' : num(x)}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-fg-3">Posición promedio: más bajo = más arriba en su lista. En negrita, el grupo que más la sube cuando la diferencia es de 1,5 puestos o más.</p>
    </div>
  );
}

function Split({ v }: { v: Extract<View, { type: 'split' }> }) {
  const items = [...v.items].sort((a, b) => b.aPct - a.aPct);
  return (
    <div>
      {v.labelA && v.labelB && (
        <div className="mb-2 flex justify-between text-xs text-fg-3"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-fg-2" />{v.labelA}</span><span>{v.labelB}<span className="ml-1 inline-block h-2 w-2 rounded-full bg-sunken ring-1 ring-border" /></span></div>
      )}
      <ul className="flex flex-col gap-3">
        {items.map((it) => (
          <li key={it.label} className="text-sm">
            <div className="mb-1 flex justify-between gap-3"><span className="font-medium">{it.label}</span><span className="tabular shrink-0 text-xs text-fg-3">{fmt.n(it.n)}{it.medianMs != null ? ` · ${sec(it.medianMs)}` : ''}</span></div>
            <div className="flex h-6 overflow-hidden rounded bg-sunken text-xs">
              <div className="flex items-center whitespace-nowrap bg-fg-2 px-2 text-bg" style={{ width: `${it.aPct}%` }}>{it.aPct >= 18 ? `${v.labelA ? '' : `${it.a} `}${fmt.pct(it.aPct)}` : ''}</div>
              <div className="flex flex-1 items-center justify-end whitespace-nowrap px-2 text-fg-2">{100 - it.aPct >= 18 ? `${fmt.pct(Math.round((100 - it.aPct) * 10) / 10)}${v.labelB ? '' : ` ${it.b}`}` : ''}</div>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-fg-3">Ordenado de más a menos {v.labelA ? `“${v.labelA}”` : 'primera opción'}. El tiempo es la mediana de lo que tardaron en ese ítem.</p>
    </div>
  );
}

function SplitByGroup({ v, groups }: { v: Extract<View, { type: 'split' }>; groups: G }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-fg-3"><th className="py-1 pr-3 font-medium">% {v.labelA ?? 'primera opción'}</th><th className="py-1 pr-3 text-right font-medium">Todos</th>{groups.map((g) => <th key={g.name} className="py-1 pr-3 text-right font-medium">{g.name}<div className="text-xs font-normal">n={g.n}</div></th>)}</tr></thead>
        <tbody>
          {v.items.map((it) => {
            const vals = groups.map((g) => it.byGroup[g.name]?.aPct).filter((x): x is number => x != null);
            const hi = Math.max(...vals), lo = Math.min(...vals);
            return (
              <tr key={it.label} className="border-t border-border">
                <td className="py-1.5 pr-3">{it.label}{!v.labelA && <span className="text-fg-3"> · {it.a}</span>}</td>
                <td className="tabular py-1.5 pr-3 text-right">{fmt.pct(it.aPct)}</td>
                {groups.map((g) => {
                  const x = it.byGroup[g.name]?.aPct;
                  return <td key={g.name} className={cn('tabular py-1.5 pr-3 text-right', hi - lo >= 20 && x === hi && 'font-semibold text-fg', hi - lo >= 20 && x === lo && 'text-fg-3')}>{x == null ? '—' : fmt.pct(x)}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Scale({ v, groups }: { v: Extract<View, { type: 'scale' }>; groups: G }) {
  const top = Math.max(...v.buckets.map((b) => b.pct), 1);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>Promedio <b className="tabular">{num(v.mean)}</b></span>
        <span>Mediana <b className="tabular">{num(v.median)}</b></span>
        <span className="text-fg-2">La mitad del medio, entre <b className="tabular">{num(v.p25)}</b> y <b className="tabular">{num(v.p75)}</b></span>
      </div>
      <div className="flex h-28 items-end gap-1">
        {v.buckets.map((b) => (
          <div key={b.from} className="flex h-full flex-1 flex-col justify-end" title={`${b.from}–${b.to}: ${b.n} (${b.pct}%)`}>
            <span className="tabular mb-0.5 text-center text-[10px] text-fg-3">{b.pct > 0 ? `${Math.round(b.pct)}%` : ''}</span>
            <div className="rounded-t bg-fg-2" style={{ height: `${(b.pct / top) * 80}%`, minHeight: b.n ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-fg-3">{v.buckets.map((b) => <span key={b.from} className="tabular flex-1 text-center">{b.from}</span>)}</div>
      {(v.labelLeft || v.labelRight) && <div className="mt-1 flex justify-between text-xs text-fg-3"><span>{v.min} = {v.labelLeft}</span><span>{v.max} = {v.labelRight}</span></div>}
      {groups.length > 0 && (
        <table className="mt-4 w-full text-sm">
          <thead><tr className="text-left text-fg-3"><th className="py-1 pr-3 font-medium">Grupo</th><th className="py-1 pr-3 text-right font-medium">n</th><th className="py-1 pr-3 text-right font-medium">Promedio</th><th className="py-1 text-right font-medium">Mediana</th></tr></thead>
          <tbody>
            {groups.map((g) => { const x = v.byGroup[g.name]; return x ? (
              <tr key={g.name} className="border-t border-border"><td className="py-1.5 pr-3">{g.name}</td><td className="tabular py-1.5 pr-3 text-right">{x.n}</td><td className="tabular py-1.5 pr-3 text-right">{num(x.mean)}</td><td className="tabular py-1.5 text-right">{num(x.median)}</td></tr>
            ) : null; })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Market({ v }: { v: Extract<View, { type: 'market' }> }) {
  return (
    <div>
      {v.realMajority && (
        <p className="mb-3 text-sm">
          La mayoría eligió de verdad <b>“{v.realMajority}”</b>. Lo adivinó el <b className="tabular">{fmt.pct(v.hitPct ?? 0)}</b>.
          {v.ref && <span className="text-fg-3"> Carta: “{v.ref}” · {fmt.n(v.realN)} respuestas.</span>}
        </p>
      )}
      <div className="mb-2 flex gap-4 text-xs text-fg-3">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-fg-2" />Creen que eligió la mayoría</span>
        {v.realMajority && <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-warning" />Eligieron de verdad</span>}
      </div>
      <ul className="flex flex-col gap-3">
        {v.rows.map((r) => (
          <li key={r.label} className="text-sm">
            <div className="mb-1 flex justify-between gap-3"><span className={cn(r.label === v.realMajority && 'font-semibold')}>{r.label}{r.label === v.realMajority && ' ✓'}</span></div>
            <div className="grid grid-cols-[1fr_3.5rem] items-center gap-2">
              <div className="h-2 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-fg-2" style={{ width: `${r.predictedPct}%` }} /></div>
              <span className="tabular text-right text-xs">{fmt.pct(r.predictedPct)}</span>
              {r.realPct != null && <>
                <div className="h-2 overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-warning" style={{ width: `${r.realPct}%` }} /></div>
                <span className="tabular text-right text-xs text-fg-3">{fmt.pct(r.realPct)}</span>
              </>}
            </div>
          </li>
        ))}
      </ul>
      {v.realMajority && <p className="mt-2 text-xs text-fg-3">Donde las dos barras se separan, la gente se equivoca sobre lo que piensan los demás.</p>}
    </div>
  );
}
