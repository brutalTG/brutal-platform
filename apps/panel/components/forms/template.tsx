'use client';

import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FormDialog, Textarea } from '@/components/ui/form';
import { saveTemplate } from '@/lib/actions';

export function TemplateButton({ k, purpose, body }: { k: string; purpose: string; body: string }) {
  const vars = [...body.matchAll(/\{(\w+)\}/g)].map((m) => m[0]);
  return (
    <FormDialog
      trigger={<Button variant="ghost" size="icon" aria-label="Editar texto" title="Editar texto" icon={<Pencil />} />}
      title="Editar mensaje del bot"
      description={purpose}
      submitLabel="Guardar"
      action={saveTemplate}
    >
      {(err) => (
        <>
          <input type="hidden" name="key" value={k} />
          <Field label="Texto" hint={vars.length ? `Variables: ${vars.join(', ')}. Se completan solas al mandarlo.` : undefined} error={err.body}>
            <Textarea name="body" defaultValue={body} className="min-h-[160px]" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
