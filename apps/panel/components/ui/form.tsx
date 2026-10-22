'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { Button } from './button';
import { useToast } from './toast';
import { cn } from '@/lib/utils';

export type FormResult = { ok: true; message?: string } | { ok: false; error: string; fields?: Record<string, string> };

const control = 'w-full rounded border border-border-strong bg-surface px-2.5 text-base text-fg outline-none placeholder:text-fg-3 focus:border-focus focus:ring-2 focus:ring-focus/20 disabled:opacity-60 aria-[invalid=true]:border-danger';

export function Field({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-sm font-medium text-fg">{label}</span>
      {children}
      {error ? <span className="text-sm text-danger">{error}</span> : hint ? <span className="text-sm text-fg-3">{hint}</span> : null}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(control, 'h-9', className)} {...p} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(control, 'min-h-[72px] py-2 leading-snug', className)} {...p} />;
});

export function Select({ options, className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select className={cn(control, 'h-9', className)} {...p}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Checkbox({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-base text-fg">
      <input type="checkbox" className="size-4 rounded border-border-strong accent-[rgb(var(--primary))]" {...p} />
      {label}
    </label>
  );
}

/**
 * Formulario en diálogo. Envía a una acción del servidor, muestra progreso,
 * deja los errores al lado de cada campo y cierra con un aviso al terminar.
 */
export function FormDialog({
  trigger, title, description, submitLabel, action, children, wide,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  action: (form: FormData) => Promise<FormResult>;
  children: (errors: Record<string, string>) => React.ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const toast = useToast();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null); setFields({});
    start(async () => {
      const r = await action(data);
      if (r.ok) {
        setOpen(false);
        toast.show(r.message ?? 'Guardado');
        router.refresh();
      } else {
        setError(r.error);
        setFields(r.fields ?? {});
      }
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!pending) { setOpen(o); setError(null); setFields({}); } }}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-surface shadow-pop',
            wide ? 'w-[min(680px,calc(100vw-32px))]' : 'w-[min(480px,calc(100vw-32px))]',
          )}
        >
          <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
            <div className="border-b border-border px-5 py-4">
              <Dialog.Title className="text-md font-semibold text-fg">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm text-fg-3">{description}</Dialog.Description>}
            </div>
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-4">
              {children(fields)}
              {error && <p role="alert" className="rounded border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <Dialog.Close asChild><Button type="button" variant="secondary" disabled={pending}>Cancelar</Button></Dialog.Close>
              <Button type="submit" variant="primary" loading={pending}>{submitLabel}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Botón que ejecuta una acción sin confirmación (reversible), con progreso y aviso. */
export function ActionButton({ action, children, ...props }: Omit<React.ComponentProps<typeof Button>, 'onClick' | 'action'> & { action: () => Promise<FormResult> }) {
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      {...props}
      loading={pending}
      onClick={() => start(async () => {
        const r = await action();
        if (r.ok) { if (r.message) toast.show(r.message); router.refresh(); } else toast.show(r.error, 'error');
      })}
    >
      {children}
    </Button>
  );
}
