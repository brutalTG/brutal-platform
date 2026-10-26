import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { from, explain } from '@/lib/db';
import { fmt } from '@/lib/utils';
import { statusOf } from '@/lib/status';
import { KIND_LABEL, STATUS_LABEL, type ReportKind } from '@/lib/reports';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardHeader, EmptyState, ErrorNotice, PageHeader, RowLink, Stat, Table, TD, TH, THead, TR } from '@/components/ui/primitives';
import { NewExperimentButton, StageButtons, StudyDialog, SubthesisActions, SubthesisDialog } from '../study-forms';

export const dynamic = 'force-dynamic';

const stages = [
  { key: 'draft', label: 'Tesis' },
  { key: 'design', label: 'Diseño' },
  { key: 'field', label: 'Campo' },
  { key: 'analysis', label: 'Análisis' },
  { key: 'published', label: 'Salida' },
];

export default async function EstudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { data: s, error } = await from('signal', 'studies').select('*').eq('slug', slug).maybeSingle();
  if (error) return <ErrorNotice message={explain(error)!} />;
  if (!s) notFound();
  const st: any = s;

  const [subQ, dropsQ, expQ, ovQ, repQ] = await Promise.all([
    from('signal', 'subtheses').select('*').eq('study_id', st.id).order('position'),
    from('drops', 'drop_overview').select('*').eq('study_slug', slug),
    from('pressure', 'experiment_overview').select('*').eq('study_slug', slug),
    from('signal', 'instrument_overview').select('app_slug, instrument_id, nodes, observations'),
    from('signal', 'reports').select('id, kind, title, status, updated_at').eq('study_id', st.id).neq('status', 'archived').order('updated_at', { ascending: false }),
  ]);
  const ov = new Map((ovQ.data ?? []).map((r: any) => [`${r.app_slug}/${r.instrument_id}`, r]));
  const instruments = [
    ...(dropsQ.data ?? []).map((d: any) => ({ key: `drops/${d.slug}`, id: d.slug, app: 'drops', name: d.name, type: 'Drop', status: statusOf('drop', d.status), build: `/experimentos?abrir=${d.id}` })),
    ...(expQ.data ?? []).map((e: any) => ({ key: `pressure/${e.slug}`, id: e.slug, app: 'pressure', name: e.name, type: 'Detector (voz)', status: statusOf('experiment', e.status), build: `/pressure/${e.slug}` })),
  ];
  const nodes = instruments.reduce((a, i) => a + Number(ov.get(i.key)?.nodes ?? 0), 0);
  const answers = instruments.reduce((a, i) => a + Number(ov.get(i.key)?.observations ?? 0), 0);
  const stx = statusOf('study', st.status);

  return (
    <>
      <PageHeader
        crumbs={[{ href: '/estudios', label: 'Estudios' }]}
        title={st.name}
        meta={<Badge tone={stx.tone}>{stx.label}</Badge>}
        actions={<><StudyDialog study={st} trigger={<Button icon={<Pencil />}>Editar</Button>} /><NewExperimentButton studyId={st.id} /></>}
      />

      <Card className="mb-6">
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <Item label="La pregunta" value={st.question} />
          <Item label="La tesis" value={st.thesis} />
          <Item label="Para quién" value={st.audience} />
          <Item label="Cómo decidimos" value={st.decision_rule} />
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
          <span className="text-sm text-fg-3">Etapa</span>
          <StageButtons id={st.id} current={st.status} stages={stages} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sub-tesis" value={fmt.n((subQ.data ?? []).length)} />
        <Stat label="Experimentos" value={fmt.n(instruments.length)} />
        <Stat label="Nodos" value={fmt.n(nodes)} hint="Suma por experimento" />
        <Stat label="Respuestas" value={fmt.n(answers)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sub-tesis" description="Cada una, algo que una o dos cartas pueden probar." action={<SubthesisDialog studyId={st.id} trigger={<Button size="sm" icon={<Plus />}>Agregar</Button>} />} />
          {(subQ.data ?? []).length === 0 ? <EmptyState title="Sin sub-tesis" description="Partí la tesis en afirmaciones chicas que se puedan medir." /> : (
            <ul className="divide-y divide-border">
              {(subQ.data ?? []).map((x: any) => (
                <li key={x.id} className="flex gap-3 px-4 py-3">
                  <span className="tabular mt-0.5 h-fit shrink-0 rounded-sm bg-sunken px-1.5 text-xs font-medium text-fg-2">{x.code}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-base">{x.statement}</div>
                    {x.expected && <div className="mt-0.5 text-sm text-fg-3">Esperamos: {x.expected}</div>}
                  </div>
                  <SubthesisActions studyId={st.id} sub={x} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Experimentos" description="Armarlos, ver cómo van y leer sus resultados." />
          {instruments.length === 0 ? <EmptyState title="Sin experimentos" description="Tocá «Armar experimento»: se crea uno atado a este estudio." action={<NewExperimentButton studyId={st.id} />} /> : (
            <Table>
              <THead><tr><TH>Experimento</TH><TH>Estado</TH><TH align="right">Nodos</TH><TH /></tr></THead>
              <tbody>
                {instruments.map((i) => (
                  <TR key={i.key}>
                    <TD><RowLink href={i.build}>{i.name}</RowLink><div className="text-xs text-fg-3">{i.type}</div></TD>
                    <TD><Badge tone={i.status.tone}>{i.status.label}</Badge></TD>
                    <TD align="right">{fmt.n(ov.get(i.key)?.nodes ?? 0)}</TD>
                    <TD align="right"><Link href={`/resultados/${i.app}/${encodeURIComponent(i.id)}`} className="text-sm text-fg-2 hover:underline">Resultados</Link></TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Informes" description="Hallazgos, Black Briefs y piezas de este estudio." />
        {(repQ.data ?? []).length === 0 ? <EmptyState title="Sin informes todavía" description="Se arman desde los resultados de cada experimento." /> : (
          <ul className="divide-y divide-border">
            {(repQ.data ?? []).map((r: any) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <RowLink href={`/informes/${r.id}`}>{r.title}</RowLink>
                <span className="text-xs text-fg-3">{KIND_LABEL[r.kind as ReportKind]} · {STATUS_LABEL[r.status]} · {fmt.ago(r.updated_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-fg-3">{label}</div>
      <div className={`mt-1 whitespace-pre-line ${value ? 'text-base' : 'text-sm text-fg-3'}`}>{value || 'Sin completar'}</div>
    </div>
  );
}
