'use client';

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Mic, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { simulateAmigos } from '@/lib/amigos-actions';

const QUICK = ['Quiero jugar con mi grupo', 'A', 'B', '1', '2', '3', 'SI', 'NO', 'SALTEAR', 'IDEAS', 'TABLA', 'AYUDA'];

// Solo test: escribirle al juego como si fueras otra persona. La conversación queda abajo, con imágenes y audios.
export function Simulator({ initialPhone }: { initialPhone: string }) {
  const [phone, setPhone] = React.useState(initialPhone);
  const [text, setText] = React.useState('');
  const [pending, start] = React.useTransition();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const toast = useToast();

  function send(t: string, audio = false) {
    start(async () => {
      const r = await simulateAmigos(phone, t, audio);
      if (!r.ok) { toast.show(r.error, 'error'); return; }
      setText('');
      const q = new URLSearchParams(params.toString());
      if (r.phone) q.set('tel', r.phone);
      router.replace(`${path}?${q.toString()}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Número" className="w-48" inputMode="tel" placeholder="11 5555 1234" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <Input aria-label="Mensaje" className="min-w-0 flex-1" placeholder="Escribile al bot…" value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" variant="primary" loading={pending} icon={<Send />}>Mandar</Button>
          <Button type="button" variant="secondary" disabled={pending} icon={<Mic />} onClick={() => send('', true)}>Audio</Button>
        </form>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q} type="button" disabled={pending} onClick={() => send(q)}
            className="rounded-full border border-border-strong bg-surface px-2.5 py-0.5 text-sm text-fg-2 hover:bg-sunken hover:text-fg disabled:opacity-50">
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
