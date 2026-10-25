'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Card, CardHeader } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { saveOnboarding } from '@/lib/experiments-actions';
import { formatLocations, type OnboardingTexts } from '@/lib/onboarding';

export function OnboardingForm({ texts }: { texts: OnboardingTexts }) {
  const toast = useToast();
  const [err, setErr] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const r = await saveOnboarding(new FormData(e.currentTarget)).catch(() => ({ ok: false as const, error: 'Se cortó la conexión.' }));
    setBusy(false);
    setErr(!r.ok && 'fields' in r ? r.fields ?? {} : {});
    toast.show(r.ok ? r.message : r.error, r.ok ? 'success' : 'error');
  }

  const step = (n: number, title: string, description: string, body: React.ReactNode) => (
    <Card>
      <CardHeader title={<span><span className="tabular mr-2 text-fg-3">{n}</span>{title}</span>} description={description} />
      <div className="grid gap-4 p-4">{body}</div>
    </Card>
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {step(1, 'Bienvenida', 'Lo primero que ve al abrir el link.', <>
        <Field label="Título" error={err['intro.title']}><Input name="intro.title" defaultValue={texts.intro.title} /></Field>
        <Field label="Bajada" error={err['intro.subtitle']}><Textarea name="intro.subtitle" rows={2} defaultValue={texts.intro.subtitle} /></Field>
      </>)}
      {step(2, 'Apodo', 'Así aparece en el ranking. No pedimos el nombre real.', <>
        <Field label="Pregunta" hint="Cada renglón es una línea en pantalla." error={err['nickname.copy']}><Textarea name="nickname.copy" rows={2} defaultValue={texts.nickname.copy} /></Field>
        <Field label="Texto de ayuda dentro del campo" error={err['nickname.placeholder']}><Input name="nickname.placeholder" defaultValue={texts.nickname.placeholder} /></Field>
      </>)}
      {step(3, 'Edad', 'Define si es menor (los menores nunca cobran plata, solo tickets).', <>
        <Field label="Pregunta" error={err['age.copy']}><Textarea name="age.copy" rows={2} defaultValue={texts.age.copy} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Edad mínima" hint="Entre 15 y 35." error={err['age.min']}><Input name="age.min" type="number" min={15} max={35} defaultValue={texts.age.min} /></Field>
          <Field label="Edad máxima" hint="Entre 15 y 35." error={err['age.max']}><Input name="age.max" type="number" min={15} max={35} defaultValue={texts.age.max} /></Field>
        </div>
        <Field label="Mensaje si queda afuera por edad" error={err['age.rejectMessage']}><Textarea name="age.rejectMessage" rows={2} defaultValue={texts.age.rejectMessage} /></Field>
      </>)}
      {step(4, 'Género', 'Una opción por renglón.', <>
        <Field label="Pregunta" error={err['gender.copy']}><Textarea name="gender.copy" rows={2} defaultValue={texts.gender.copy} /></Field>
        <Field label="Opciones" error={err['gender.options']}><Textarea name="gender.options" rows={4} defaultValue={texts.gender.options.join('\n')} /></Field>
      </>)}
      {step(5, 'Dónde vive', 'Un lugar por renglón. Para ofrecer barrios o ciudades: «Lugar: barrio, barrio, barrio».', <>
        <Field label="Pregunta" error={err['location.copy']}><Textarea name="location.copy" rows={2} defaultValue={texts.location.copy} /></Field>
        <Field label="Lugares" error={err['location.options']}><Textarea name="location.options" rows={6} className="font-mono text-sm" defaultValue={formatLocations(texts.location.options)} /></Field>
      </>)}
      {step(6, 'Plataformas', 'Qué usa todos los días. Una por renglón.', <>
        <Field label="Pregunta" error={err['platforms.copy']}><Textarea name="platforms.copy" rows={2} defaultValue={texts.platforms.copy} /></Field>
        <Field label="Opciones" error={err['platforms.options']}><Textarea name="platforms.options" rows={5} defaultValue={texts.platforms.options.join('\n')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mínimo a elegir" error={err['platforms.minSelect']}><Input name="platforms.minSelect" type="number" min={1} max={10} defaultValue={texts.platforms.minSelect} /></Field>
          <Field label="Máximo a elegir" error={err['platforms.maxSelect']}><Input name="platforms.maxSelect" type="number" min={1} max={10} defaultValue={texts.platforms.maxSelect} /></Field>
        </div>
      </>)}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-end gap-3 border-t border-border bg-bg/95 px-1 py-3 backdrop-blur">
        <span className="text-sm text-fg-3">Al terminar, entra directo al Drop publicado.</span>
        <Button type="submit" variant="primary" loading={busy}>Guardar onboarding</Button>
      </div>
    </form>
  );
}
