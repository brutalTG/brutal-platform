import { loadBuilder } from '@/lib/experiments-actions';
import { ErrorNotice, PageHeader } from '@/components/ui/primitives';
import { Builder } from '@/components/experiments/Builder';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Experimentos' };

export default async function ExperimentsPage({ searchParams }: { searchParams: Promise<{ abrir?: string }> }) {
  const { abrir } = await searchParams;
  const r = await loadBuilder();
  return (
    <>
      <PageHeader title="Experimentos" description="Armá el recorrido: elegí piezas de la caja de herramientas, ordenalas, probalo en el teléfono y publicalo." />
      {r.ok ? <Builder tab="experimentos" openId={abrir} detectors={r.detectors} initial={{ questions: r.questions as any, drops: r.drops as any, studies: r.studies }} /> : <ErrorNotice message={r.error} />}
    </>
  );
}
