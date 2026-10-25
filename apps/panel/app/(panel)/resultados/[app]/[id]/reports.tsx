'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { readResults } from '@/lib/reports-actions';
import { KIND_LABEL, STATUS_LABEL, type ReportKind } from '@/lib/reports';
import { fmt } from '@/lib/utils';

export function ReportsPanel({ app, instrumentId, hasStudy, hasData, reports }: {
  app: string; instrumentId: string; hasStudy: boolean; hasData: boolean;
  reports: { id: string; kind: ReportKind; title: string; status: string; author: string; created_at: string }[];
}) {
  const [busy, setBusy] = React.useState(false);
  const toast = useToast();
  const router = useRouter();

  async function read() {
    setBusy(true);
    const r = await readResults(app, instrumentId).catch(() => ({ ok: false as const, error: 'Se cortó la conexión.' }));
    setBusy(false);
    if (!r.ok) return toast.show(r.error, 'error');
    toast.show('Listo: borrador de hallazgos guardado.');
    router.push(`/informes/${r.id}`);
  }

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="font-medium">Lectura e informe</div>
          <div className="text-sm text-fg-3">
            La IA cruza estos resultados {hasStudy ? 'contra la tesis del estudio' : '(sin estudio asociado: va a proponer una tesis)'} y deja un borrador que editás. De ahí sale el Black Brief o la pieza.
          </div>
        </div>
        <Button variant="primary" icon={<Sparkles />} loading={busy} disabled={!hasData} onClick={read}>
          {busy ? 'Leyendo… (hasta 2 min)' : 'Leer resultados'}
        </Button>
      </div>
      {reports.length > 0 && (
        <ul className="border-t border-border">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-2 last:border-0">
              <Link href={`/informes/${r.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                <FileText className="size-4 shrink-0 text-fg-3" />
                <span className="truncate">{r.title}</span>
              </Link>
              <span className="shrink-0 text-xs text-fg-3">{KIND_LABEL[r.kind]} · {STATUS_LABEL[r.status] ?? r.status} · {fmt.ago(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
