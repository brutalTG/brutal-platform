'use client';

import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FormDialog, Input } from '@/components/ui/form';
import { inviteNode } from '@/lib/pressure-actions';

// Invitar a alguien: se carga su número. Cuando escriba al WhatsApp de BRUTAL, el bot le responde.
export function InviteButton() {
  return (
    <FormDialog
      trigger={<Button variant="primary" icon={<UserPlus />}>Invitar</Button>}
      title="Invitar a un nodo"
      description="El bot solo le contesta a los números cargados acá. No le escribimos primero: la persona tiene que mandar un mensaje."
      submitLabel="Invitar"
      action={inviteNode}
    >
      {(err) => (
        <>
          <Field label="WhatsApp" hint="Con código de área. Ej: 11 5555 1234 o +34 612 345 678." error={err.phone}>
            <Input name="phone" inputMode="tel" autoComplete="off" required autoFocus />
          </Field>
          <Field label="Apodo (opcional)" hint="Solo para reconocerlo en el panel. Nunca se le pide el nombre." error={err.nickname}>
            <Input name="nickname" maxLength={40} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
