'use client';
// Embudo en vivo: se refresca solo cada 15 segundos (y al volver a la pestaña).
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { funnelData, type FunnelData, type FunnelWindow } from '@/lib/funnel';
import { Card, CardHeader } from '@/components/ui/primitives';

const WINDOWS: [FunnelWindow, string][] = [['1h', 'Última hora'], ['hoy', 'Hoy'], ['7d', '7 días']];
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const hhmmss = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

export function FunnelLive({ initial }: { initial: FunnelData }) {
  const [data, setData] = useState(initial);
  const [win, setWin] = useState<FunnelWindow>(initial.window);
  const [pending, start] = useTransition();
  const winRef = useRef(win);
  winRef.current = win;

  const refresh = useCallback(() => start(async () => { setData(await funnelData(winRef.current)); }), []);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15_000);
    const onVis = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [refresh]);
  useEffect(() => { refresh(); }, [win, refresh]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-border p-0.5" role="tablist">
          {WINDOWS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={win === k} onClick={() => setWin(k)}
              className={`rounded px-3 py-1.5 text-sm ${win === k ? 'bg-sunken font-semibold text-fg' : 'text-fg-3'}`}>{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-success" /></span>
          <b className="tabular-nums">{data.liveNow}</b> <span className="text-fg-3">jugando ahora</span>
        </div>
        <span className="ml-auto text-xs text-fg-3">{pending ? 'Actualizando…' : `Actualizado ${hhmmss(data.at)}`}{data.drop ? ` · ${data.drop.name}` : ''}</span>
      </div>

      {data.error && <p className="rounded-md border border-border bg-sunken px-3 py-2 text-sm text-warning">No pude leer los datos: {data.error}</p>}
      {!data.error && data.channels.length === 0 && <Card><p className="px-4 py-8 text-center text-sm text-fg-3">Todavía no entró nadie nuevo en esta ventana.</p></Card>}

      {(['ads', 'organic'] as const).map((k) => {
        const list = data.channels.filter((c) => c.kind === k);
        if (!list.length) return null;
        return (
          <section key={k} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-fg-2">{k === 'ads' ? 'Tus anuncios' : 'Sin anuncio'}</h2>
            <Channels list={list} />
          </section>
        );
      })}
      {data.channels.some((c) => c.kind === 'internal') && (
        <details className="rounded-md border border-border px-4 py-3">
          <summary className="cursor-pointer text-sm text-fg-3">
            Pruebas internas ({data.channels.filter((c) => c.kind === 'internal').reduce((a, c) => a + (c.steps[0]?.n ?? 0), 0)} personas) — no son gente de los anuncios
          </summary>
          <div className="mt-3"><Channels list={data.channels.filter((c) => c.kind === 'internal')} /></div>
        </details>
      )}

      {data.onboardingDrop.length > 0 && (
        <Card>
          <CardHeader title="Onboarding: dónde se bajan" description="Llegaron = vieron esa pregunta. Se fueron = fue la última que vieron y no volvieron en 10 minutos." />
          <Rows rows={data.onboardingDrop.map((r) => ({ key: r.step, label: r.label, reached: r.reached, left: r.leftHere }))} />
        </Card>
      )}

      {data.cards.length > 0 && data.cards[0].reached > 0 && (
        <Card>
          <CardHeader title="Drop: carta por carta" description="Llegaron = vieron esa carta. Se fueron = abandonaron ahí (sin actividad hace más de 10 minutos)." />
          <Rows rows={data.cards.map((r) => ({ key: String(r.position), label: `${r.position + 1}. ${r.label}`, reached: r.reached, left: r.leftHere }))} />
        </Card>
      )}
    </div>
  );
}

function Rows({ rows }: { rows: { key: string; label: string; reached: number; left: number }[] }) {
  const top = Math.max(1, ...rows.map((r) => r.reached));
  return (
    <ol className="flex flex-col gap-2 px-4 py-4">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-sm text-fg-2">{r.label}</span>
          <span className="text-right text-sm tabular-nums"><b>{r.reached}</b>{r.left > 0 && <span className="text-warning"> · se fueron {r.left}</span>}</span>
          <div className="col-span-2 h-2 w-full overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-fg transition-all" style={{ width: `${pct(r.reached, top)}%` }} /></div>
        </li>
      ))}
    </ol>
  );
}

function Channels({ list }: { list: FunnelData['channels'] }) {
  return (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((c) => {
            const top = c.steps[0]?.n || 1;
            return (
              <Card key={c.channel}>
                <CardHeader title={c.label} description={`${c.steps[0]?.n ?? 0} personas nuevas${c.liveNow ? ` · ${c.liveNow} jugando ahora` : ''}`} />
                <ol className="flex flex-col gap-2.5 px-4 py-4">
                  {c.steps.map((s, i) => {
                    const prev = i > 0 ? c.steps[i - 1].n : s.n;
                    const lost = i > 0 ? prev - s.n : 0;
                    return (
                      <li key={s.key}>
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                          <span className="text-fg-2">{s.label}{s.meta && <span className="ml-2 rounded bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-fg-3" title="Evento del Pixel de Meta">Meta · {s.meta}</span>}</span>
                          <span className="tabular-nums"><b>{s.n}</b>{i > 0 && <span className="text-fg-3"> · {pct(s.n, prev)}%</span>}{lost > 0 && <span className="text-warning"> · −{lost}</span>}</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-sunken"><div className="h-full rounded-full bg-fg transition-all" style={{ width: `${pct(s.n, top)}%` }} /></div>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            );
          })}
        </div>
  );
}
