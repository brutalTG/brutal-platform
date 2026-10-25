'use client';

import * as React from 'react';
import { Field, FormDialog, Input, Select, Textarea } from '@/components/ui/form';
import { saveQuestion } from '@/lib/amigos-actions';

export type QuestionRow = {
  id: string; prompt: string; detail: string | null; option_a: string; option_b: string; origin: string; tone: string;
  subthesis_id: string | null; scheduled_for: string | null; status: string; tags: string[]; offered: number; picked: number;
};
export type SubthesisOption = { id: string; label: string };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

// Formulario de pregunta con la imagen tal como le llega a la gente, mientras se escribe.
function Fields({ q, errors, subtheses }: { q?: QuestionRow; errors: Record<string, string>; subtheses: SubthesisOption[] }) {
  const [prompt, setPrompt] = React.useState(q?.prompt ?? '');
  const [detail, setDetail] = React.useState(q?.detail ?? '');
  const [a, setA] = React.useState(q?.option_a ?? '');
  const [b, setB] = React.useState(q?.option_b ?? '');
  const [origin, setOrigin] = React.useState(q?.origin === 'national' ? 'national' : 'house');
  const [tone, setTone] = React.useState(q?.tone ?? 'fun');
  const d = useDebounced({ prompt, detail, a, b, origin }, 500);
  const src = `/amigos/preview?${new URLSearchParams({ prompt: d.prompt, detail: d.detail, a: d.a, b: d.b, by: d.origin === 'national' ? 'Pregunta de BRUTAL · TODO EL PAÍS' : 'Pregunta de Fede · LOSPIBES' })}`;

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_260px]">
      <div className="flex flex-col gap-4">
        {q && <input type="hidden" name="id" value={q.id} />}
        <Field label="Dilema" hint={`${prompt.length}/280. Dos cosas que la persona dice valorar; cualquier respuesta le cuesta algo.`} error={errors.prompt}>
          <Textarea name="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={280} required />
        </Field>
        <Field label="Segunda línea (opcional)" hint="Va en gris debajo del dilema." error={errors.detail}>
          <Input name="detail" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={200} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Opción A" error={errors.option_a}><Input name="option_a" value={a} onChange={(e) => setA(e.target.value)} maxLength={40} required /></Field>
          <Field label="Opción B" error={errors.option_b}><Input name="option_b" value={b} onChange={(e) => setB(e.target.value)} maxLength={40} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" error={errors.origin}>
            <Select name="origin" value={origin} onChange={(e) => setOrigin(e.target.value)} options={[{ value: 'house', label: 'Biblioteca (el bot la sugiere)' }, { value: 'national', label: 'Nacional (todos los grupos, un día)' }]} />
          </Field>
          {origin === 'national' ? (
            <Field label="Fecha" error={errors.scheduled_for}><Input type="date" name="scheduled_for" defaultValue={q?.scheduled_for ?? ''} /></Field>
          ) : (
            <Field label="Estado" error={errors.status}>
              <Select name="status" defaultValue={q?.status ?? 'draft'} options={[{ value: 'draft', label: 'Borrador' }, { value: 'active', label: 'Activa' }, { value: 'retired', label: 'Retirada' }]} />
            </Field>
          )}
        </div>
        {origin === 'national' && <input type="hidden" name="status" value="active" />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Para qué" error={errors.tone}>
            <Select name="tone" value={tone} onChange={(e) => setTone(e.target.value)} options={[{ value: 'fun', label: 'Juego' }, { value: 'signal', label: 'Señal (apunta a una sub-tesis)' }]} />
          </Field>
          <Field label="Etiquetas" hint="Separadas por coma. «apertura» = se ofrece al armar un grupo."><Input name="tags" defaultValue={(q?.tags ?? []).join(', ')} /></Field>
        </div>
        {tone === 'signal' && (
          <Field label="Sub-tesis" error={errors.subthesis_id}>
            <Select name="subthesis_id" defaultValue={q?.subthesis_id ?? ''} options={[{ value: '', label: 'Elegí…' }, ...subtheses.map((s) => ({ value: s.id, label: s.label }))]} />
          </Field>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-fg">Así le llega</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Vista previa de la imagen de la pregunta" className="w-full rounded border border-border bg-black" />
      </div>
    </div>
  );
}

export function QuestionDialog({ q, trigger, subtheses }: { q?: QuestionRow; trigger: React.ReactNode; subtheses: SubthesisOption[] }) {
  return (
    <FormDialog trigger={trigger} title={q ? 'Editar pregunta' : 'Nueva pregunta'} description="Lo que el bot sugiere a quien le toca preguntar. Las que nadie elige mueren solas."
      submitLabel={q ? 'Guardar' : 'Crear'} action={saveQuestion} wide>
      {(errors) => <Fields q={q} errors={errors} subtheses={subtheses} />}
    </FormDialog>
  );
}
