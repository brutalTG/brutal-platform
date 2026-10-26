'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Download, Eye, Megaphone, Pencil, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { Markdown } from '@/components/md/markdown';
import { deriveReport, saveReport } from '@/lib/reports-actions';
import { STATUS_LABEL, type ReportKind } from '@/lib/reports';

type Report = { id: string; kind: ReportKind; title: string; body: string; status: string; app: string | null; instrumentId: string | null };

export function Editor({ report }: { report: Report }) {
  const [title, setTitle] = React.useState(report.title);
  const [body, setBody] = React.useState(report.body);
  const [status, setStatus] = React.useState(report.status);
  const [mode, setMode] = React.useState<'read' | 'edit'>('read');
  const [saved, setSaved] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  // Guardado automático un segundo después de dejar de escribir.
  React.useEffect(() => {
    if (saved) return;
    const t = setTimeout(async () => {
      const r = await saveReport(report.id, { title, body });
      if (r.ok) setSaved(true); else toast.show(r.error, 'error');
    }, 1000);
    return () => clearTimeout(t);
  }, [title, body, saved, report.id, toast]);

  async function setSt(s: string) {
    setStatus(s);
    const r = await saveReport(report.id, { status: s });
    toast.show(r.ok ? `Marcado como ${STATUS_LABEL[s].toLowerCase()}` : r.error, r.ok ? 'success' : 'error');
  }

  async function derive(kind: 'black_brief' | 'post') {
    if (!saved) await saveReport(report.id, { title, body });
    setBusy(kind);
    const r = await deriveReport(report.id, kind).catch(() => ({ ok: false as const, error: 'Se cortó la conexión.' }));
    setBusy(null);
    if (!r.ok) return toast.show(r.error, 'error');
    router.push(`/informes/${r.id}`);
  }

  function download() {
    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase().slice(0, 60) || 'informe'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded border border-border p-0.5">
          <button onClick={() => setMode('read')} className={`flex items-center gap-1 rounded px-2 py-1 text-sm ${mode === 'read' ? 'bg-sunken font-medium' : 'text-fg-2'}`}><Eye className="size-4" /> Leer</button>
          <button onClick={() => setMode('edit')} className={`flex items-center gap-1 rounded px-2 py-1 text-sm ${mode === 'edit' ? 'bg-sunken font-medium' : 'text-fg-2'}`}><Pencil className="size-4" /> Editar</button>
        </div>
        <select value={status} onChange={(e) => setSt(e.target.value)} className="h-8 rounded border border-border bg-surface px-2 text-sm">
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="text-xs text-fg-3">{saved ? 'Guardado' : 'Guardando…'}</span>
        <span className="flex-1" />
        {report.app && report.instrumentId && <Link href={`/resultados/${report.app}/${encodeURIComponent(report.instrumentId)}`} className="text-sm text-fg-2 hover:underline">Ver resultados</Link>}
        <Button size="sm" icon={<Copy />} onClick={() => { navigator.clipboard.writeText(body); toast.show('Copiado'); }}>Copiar</Button>
        <Button size="sm" icon={<Download />} onClick={download}>Descargar</Button>
      </div>

      {report.kind === 'findings' && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="text-sm text-fg-2">Cuando los hallazgos estén bien, armá la salida. La IA parte de lo que editaste acá.</div>
            <div className="flex gap-2">
              <Button icon={<ScrollText />} loading={busy === 'black_brief'} disabled={!!busy} onClick={() => derive('black_brief')}>Armar Black Brief</Button>
              <Button icon={<Megaphone />} loading={busy === 'post'} disabled={!!busy} onClick={() => derive('post')}>Armar pieza para redes</Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        {mode === 'edit' ? (
          <div className="flex flex-col gap-3">
            <input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} className="w-full border-b border-border bg-transparent pb-2 text-xl font-bold outline-none" placeholder="Título" />
            <textarea value={body} onChange={(e) => { setBody(e.target.value); setSaved(false); }} rows={30} className="w-full resize-y bg-transparent font-mono text-sm leading-relaxed outline-none" placeholder="Escribí en Markdown: # título, ## sección, **negrita**, - listas." />
          </div>
        ) : body.trim() ? <Markdown source={body} /> : <p className="text-fg-3">Vacío. Tocá «Editar» para escribir.</p>}
      </Card>
    </div>
  );
}
