'use client';

import { useState, useTransition } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { markMessageSent } from '@/lib/actions';

/** Un mensaje en cola: se abre en WhatsApp con el texto listo y después se marca como enviado. */
export function QueuedMessageActions({ id, phone, body }: { id: string; phone: string; body: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const wa = `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(body)}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={wa} target="_blank" rel="noreferrer" className={buttonVariants({ variant: 'primary', size: 'sm' })}><ExternalLink />Abrir en WhatsApp</a>
      <Button variant="secondary" size="sm" icon={<Check />} loading={pending} onClick={() => start(async () => { const r = await markMessageSent(id); setError(r.ok ? null : r.error); })}>
        Ya lo mandé
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
