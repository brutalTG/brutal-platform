import { notFound } from 'next/navigation';
import { from } from '@/lib/db';
import { PageHeader } from '@/components/ui/primitives';
import { KIND_LABEL, type ReportKind } from '@/lib/reports';
import { Editor } from './editor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: r } = await from('signal', 'reports').select('*').eq('id', id).maybeSingle();
  if (!r) notFound();
  const x: any = r;
  return (
    <>
      <PageHeader crumbs={[{ href: '/informes', label: 'Informes' }]} title={KIND_LABEL[x.kind as ReportKind]} />
      <Editor report={{ id: x.id, kind: x.kind, title: x.title, body: x.body, status: x.status, app: x.app_slug, instrumentId: x.instrument_id }} />
    </>
  );
}
