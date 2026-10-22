'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { Button } from './button';
import { useToast } from './toast';

type Result = { ok: true; message?: string } | { ok: false; error: string };

// Acción con confirmación: abre un diálogo, ejecuta en el servidor, muestra progreso,
// y termina con un aviso de éxito o con el error dentro del diálogo.
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  tone = 'default',
  action,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  action: () => Promise<Result>;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const toast = useToast();

  function run() {
    setError(null);
    start(async () => {
      const r = await action();
      if (r.ok) {
        setOpen(false);
        toast.show(r.message ?? 'Listo');
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!pending) { setOpen(o); setError(null); } }}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-pop">
          <Dialog.Title className="text-md font-semibold text-fg">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-base text-fg-2">{description}</Dialog.Description>
          {error && (
            <p role="alert" className="mt-3 rounded border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary" disabled={pending}>Cancelar</Button>
            </Dialog.Close>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={pending} onClick={run} autoFocus>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
