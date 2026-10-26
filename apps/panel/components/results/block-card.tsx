import { type Block, type Cut } from '@/lib/results';
import { fmt, cn } from '@/lib/utils';
import { Card } from '@/components/ui/primitives';

const KIND: Record<string, string> = {
  Toque: 'Ráfaga · toque', Repregunta: 'Repregunta por voz', rafaga: 'Vuelta por voz', game: 'Pregunta por voz', calibration: 'Calibración',
  choice: 'Elegir', choice_emoji: 'Elegir emoji', choice_hybrid: 'Elegir mixto', slider: 'Escala', slider_emoji: 'Escala emoji', confesionario: 'Confesionario',
  prediction_bet: 'Apuesta', ranking: 'Ordenar', binary_media: 'Imagen A/B', rafaga_emoji: 'Ráfaga', rafaga_burst: 'Ráfaga', hot_take: 'Hot take',
  hot_take_visual: 'Hot take', trap: 'Trampa', trap_silent: 'Trampa silenciosa', dead_drop: 'Dead drop', media_reaction: 'Reacción a imagen',
  voice: 'Pregunta por voz', mayor_menor: 'Mayor o menor', game_move: 'Juego', declared: 'Calibración',
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
