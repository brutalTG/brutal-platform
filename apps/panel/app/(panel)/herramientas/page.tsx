import { loadBuilder } from '@/lib/experiments-actions';
import { ErrorNotice, PageHeader } from '@/components/ui/primitives';
import { Builder } from '@/components/experiments/Builder';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Caja de herramientas' };

export default async function ToolboxPage() {
  const r = await loadBuilder();
  return (
    <>
      <PageHeader title="Caja de herramientas" description="Todas las piezas: ráfagas, elecciones, escalas, trampas, confesionarios. Las creás acá y las sumás a cualquier experimento." />
      {r.ok ? <Builder tab="piezas" initial={{ questions: r.questions as any, drops: r.drops as any }} /> : <ErrorNotice message={r.error} />}
    </>
  );
}
