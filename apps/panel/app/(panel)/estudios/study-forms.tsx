'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FormDialog, Input, Textarea } from '@/components/ui/form';
import { ConfirmAction } from '@/components/ui/confirm';
import { useToast } from '@/components/ui/toast';
import { newExperimentForStudy, removeSubthesis, saveStudy, saveSubthesis, setStudyStatus } from '@/lib/studies-actions';

export type StudyFields = { id: string; name: string; thesis: string | null; question: string | null; audience: string | null; decision_rule: string | null };

export function StudyDialog({ study, trigger }: { study?: StudyFields; trigger: React.ReactNode }) {
  const router = useRouter();
  return (
    <FormDialog
      wide
      trigger={trigger}
      title={study ? 'Editar estudio' : 'Nuevo estudio'}
      description="Un estudio es una pregunta sobre la generación. Los experimentos son las formas de contestarla."
      submitLabel={study ? 'Guardar' : 'Crear estudio'}
      action={async (f) => {
        const r = await saveStudy(f);
        if (r.ok && r.slug) router.push(`/estudios/${r.slug}`);
        return r;
      }}
    >
      {(err) => (
        <>
          <input type="hidden" name="id" value={study?.id ?? ''} />
          <Field label="Nombre" error={err.name}><Input name="name" defaultValue={study?.name ?? ''} placeholder="Arriba o al lado" autoFocus /></Field>
          <Field label="La pregunta" hint="Qué queremos saber, dicho simple."><Textarea name="question" rows={2} defaultValue={study?.question ?? ''} placeholder="¿Los pibes quieren jefe o quieren no tener que pedir permiso?" /></Field>
          <Field label="La tesis" hint="Lo que creemos que es cierto y vamos a poner a prueba."><Textarea name="thesis" rows={3} defaultValue={study?.thesis ?? ''} /></Field>
          <Field label="Para quién" hint="Marcas, prensa, política: a quién le cambia algo saberlo."><Input name="audience" defaultValue={study?.audience ?? ''} /></Field>
          <Field label="Cómo decidimos" hint="Qué tendría que pasar en los datos para confirmarla, y qué para refutarla."><Textarea name="decision_rule" rows={3} defaultValue={study?.decision_rule ?? ''} placeholder="Se confirma si más de 6 de cada 10 eligen... Se cae si los menores de 21 eligen..." /></Field>
        </>
      )}
    </FormDialog>
  );
}

export function SubthesisDialog({ studyId, sub, trigger }: { studyId: string; sub?: { id: string; code: string; statement: string; expected: string | null }; trigger: React.ReactNode }) {
  return (
    <FormDialog trigger={trigger} title={sub ? `Editar ${sub.code}` : 'Nueva sub-tesis'} description="Una afirmación que una o dos cartas pueden probar." submitLabel="Guardar" action={saveSubthesis}>
      {(err) => (
        <>
          <input type="hidden" name="id" value={sub?.id ?? ''} />
          <input type="hidden" name="study_id" value={studyId} />
          <Field label="Código" hint="Se completa solo (S1, S2…)."><Input name="code" defaultValue={sub?.code ?? ''} className="w-28" /></Field>
          <Field label="Sub-tesis" error={err.statement}><Textarea name="statement" rows={3} defaultValue={sub?.statement ?? ''} /></Field>
          <Field label="Qué esperamos ver si es cierta"><Textarea name="expected" rows={2} defaultValue={sub?.expected ?? ''} /></Field>
        </>
      )}
    </FormDialog>
  );
}

export function SubthesisActions({ studyId, sub }: { studyId: string; sub: { id: string; code: string; statement: string; expected: string | null } }) {
  return (
    <div className="flex shrink-0 gap-1">
      <SubthesisDialog studyId={studyId} sub={sub} trigger={<Button size="icon" variant="ghost" aria-label="Editar"><Pencil /></Button>} />
      <ConfirmAction trigger={<Button size="icon" variant="ghost" aria-label="Borrar"><Trash2 /></Button>} title={`¿Borrar ${sub.code}?`} description="Las cartas que la medían quedan sin sub-tesis." confirmLabel="Borrar" tone="danger" action={() => removeSubthesis(sub.id)} />
    </div>
  );
}

export function StageButtons({ id, current, stages }: { id: string; current: string; stages: { key: string; label: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();
  return (
    <div className="flex flex-wrap gap-1">
      {stages.map((s) => (
        <button key={s.key} disabled={pending || s.key === current} onClick={() => start(async () => {
          const r = await setStudyStatus(id, s.key);
          if (r.ok) router.refresh(); else toast.show(r.error, 'error');
        })} className={`rounded border px-2 py-1 text-sm ${s.key === current ? 'border-fg bg-fg text-bg' : 'border-border text-fg-2 hover:bg-sunken'}`}>{s.label}</button>
      ))}
    </div>
  );
}

export function NewExperimentButton({ studyId }: { studyId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();
  return (
    <Button variant="primary" icon={<FlaskConical />} loading={pending} onClick={() => start(async () => {
      const r = await newExperimentForStudy(studyId);
      if (!r.ok) return toast.show(r.error, 'error');
      router.push(`/experimentos?abrir=${r.id}`);
    })}>Armar experimento</Button>
  );
}

export const NewStudyButton = () => <StudyDialog trigger={<Button variant="primary" icon={<Plus />}>Nuevo estudio</Button>} />;
