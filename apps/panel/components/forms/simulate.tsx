'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FormDialog, Input } from '@/components/ui/form';
import { simulateWhatsApp } from '@/lib/pressure-actions';

// Solo test: hace de cuenta que un número le escribe al bot.
export function SimulateButton({ realMode }: { realMode: boolean }) {
  return (
    <FormDialog
      trigger={<Button variant="secondary" icon={<Send />}>Simular mensaje</Button>}
      title="Simular un mensaje entrante"
      description={realMode
        ? 'El bot está conectado a WATI: la respuesta le llega como WhatsApp real a ese número.'
        : 'WhatsApp está simulado: la respuesta del bot queda abajo y no sale nada.'}
      submitLabel="Enviar"
      action={simulateWhatsApp}
    >
      {(err) => (
        <>
          <Field label="Desde el número" error={err.phone}><Input name="phone" inputMode="tel" required autoFocus /></Field>
          <Field label="Mensaje" hint="Cualquier texto recibe el link al juego. RANKING muestra la tabla. BAJA da de baja.">
            <Input name="text" defaultValue="JUGAR" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
