import { PageHeader } from '@/components/ui/primitives';
import { funnelData } from '@/lib/funnel';
import { FunnelLive } from '@/components/funnel-live';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Embudo en vivo' };

export default async function EmbudoPage() {
  const initial = await funnelData('hoy');
  return (
    <>
      <PageHeader title="Embudo en vivo" description="Gente nueva por canal de entrada: cuántos llegan a cada paso y dónde se bajan. Se actualiza solo cada 15 segundos." />
      <FunnelLive initial={initial} />
    </>
  );
}
