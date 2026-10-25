'use client';

import * as React from 'react';
import { Send, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Card } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';
import { launch, parsePhones, type Audience, type LaunchResult } from '@/lib/launch-actions';
import { fmt } from '@/lib/utils';

export function LaunchForm({ drop, live, genders, provinces }: { drop: string; live: boolean; genders: string[]; provinces: string[] }) {
  const [type, setType] = React.useState<'all' | 'filter' | 'phones'>('all');
  const [minAge, setMinAge] = React.useState('');
  const [maxAge, setMaxAge] = React.useState('');
  const [gender, setGender] = React.useState<string[]>([]);
  const [province, setProvince] = React.useState<string[]>([]);
  const [minors, setMinors] = React.useState<'include' | 'exclude' | 'only'>('include');
  const [phones, setPhones] = React.useState('');
  const [preview, setPreview] = React.useState<LaunchResult | null>(null);
  const [busy, setBusy] = React.useState<'count' | 'send' | null>(null);
  const toast = useToast();
  const router = useRouter();

  async function audience(): Promise<Audience | null> {
    if (type === 'all') return { type: 'all' };
    if (type === 'phones') {
      const p = await parsePhones(phones);
      if (p.bad.length) { toast.show(`No entiendo estos números: ${p.bad.slice(0, 3).join(', ')}`, 'error'); return null; }
      if (!p.ok.length) { toast.show('Pegá al menos un número.', 'error'); return null; }
      return { type: 'phones', phones: p.ok };
    }
    return { type: 'filter', minAge: minAge ? Number(minAge) : null, maxAge: maxAge ? Number(maxAge) : null, genders: gender, provinces: province, minors };
  }

  async function run(dry: boolean) {
    const a = await audience();
    if (!a) return;
    if (!dry && !window.confirm(`¿Mandar a ${preview && preview.ok ? preview.audience : 'todos los que entran en el filtro'}? Les llega un WhatsApp con su link.`)) return;
    setBusy(dry ? 'count' : 'send');
    const r = await launch(drop, a, dry);
    setBusy(null);
    if (!r.ok) return toast.show(r.error, 'error');
    setPreview(r);
    if (!dry) { toast.show(`Listo: salieron ${r.sent ?? 0}${r.failed ? `, fallaron ${r.failed}` : ''}.`); router.refresh(); }
  }

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  React.useEffect(() => setPreview(null), [type, minAge, maxAge, gender, province, minors, phones]);

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          {([['all', 'Todos los nodos'], ['filter', 'Filtrar por edad, género o zona'], ['phones', 'Una lista de números']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setType(v)} className={`rounded border px-3 py-1.5 text-sm ${type === v ? 'border-fg bg-fg text-bg' : 'border-border text-fg-2 hover:bg-sunken'}`}>{l}</button>
          ))}
        </div>

        {type === 'filter' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Edad desde"><Input type="number" min={15} max={35} value={minAge} onChange={(e) => setMinAge(e.target.value)} /></Field>
              <Field label="Edad hasta"><Input type="number" min={15} max={35} value={maxAge} onChange={(e) => setMaxAge(e.target.value)} /></Field>
            </div>
            <Field label="Menores"><Select value={minors} onChange={(e) => setMinors(e.target.value as any)} options={[{ value: 'include', label: 'Incluir' }, { value: 'exclude', label: 'Solo adultos' }, { value: 'only', label: 'Solo menores' }]} /></Field>
            {genders.length > 0 && (
              <div><div className="mb-1 text-sm font-medium">Género <span className="font-normal text-fg-3">(sin marcar = todos)</span></div>
                <div className="flex flex-wrap gap-1.5">{genders.map((g) => <button key={g} onClick={() => toggle(gender, setGender, g)} className={`rounded border px-2 py-1 text-sm ${gender.includes(g) ? 'border-fg bg-fg text-bg' : 'border-border text-fg-2'}`}>{g}</button>)}</div></div>
            )}
            {provinces.length > 0 && (
              <div><div className="mb-1 text-sm font-medium">Zona <span className="font-normal text-fg-3">(sin marcar = todas)</span></div>
                <div className="flex flex-wrap gap-1.5">{provinces.map((p) => <button key={p} onClick={() => toggle(province, setProvince, p)} className={`rounded border px-2 py-1 text-sm ${province.includes(p) ? 'border-fg bg-fg text-bg' : 'border-border text-fg-2'}`}>{p}</button>)}</div></div>
            )}
          </div>
        )}

        {type === 'phones' && (
          <Field label="Números" hint="Uno por renglón o separados por coma. Tienen que estar cargados como nodos."><Textarea rows={5} value={phones} onChange={(e) => setPhones(e.target.value)} placeholder={'11 5555 1234\n+54 9 351 555 1234'} /></Field>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button icon={<Users />} loading={busy === 'count'} disabled={!!busy} onClick={() => run(true)}>Calcular a cuántos llega</Button>
          <Button variant="primary" icon={<Send />} loading={busy === 'send'} disabled={!!busy || !live || !preview || !preview.ok || preview.audience === 0} onClick={() => run(false)}>
            {preview && preview.ok ? `Mandar a ${fmt.n(preview.audience)}` : 'Mandar'}
          </Button>
          {!live && <span className="text-sm text-warning">Primero publicalo: solo se manda un experimento en juego.</span>}
        </div>

        {preview && preview.ok && (
          <div className="rounded bg-sunken p-3 text-sm">
            <div><strong>{fmt.n(preview.audience)}</strong> {preview.dryRun ? 'lo recibirían' : 'en el envío'}{preview.minors ? ` · ${fmt.n(preview.minors)} menores (cobran solo Golden Tickets)` : ''}{preview.need_onboarding ? ` · ${fmt.n(preview.need_onboarding)} pasan primero por el onboarding` : ''}.</div>
            {(preview.skipped.opted_out + preview.skipped.already_played + preview.skipped.not_allowed) > 0 && (
              <div className="mt-1 text-fg-3">Quedan afuera: {preview.skipped.already_played} ya lo jugaron · {preview.skipped.opted_out} se dieron de baja · {preview.skipped.not_allowed} bloqueados, archivados o en espera.</div>
            )}
            {preview.truncated && <div className="mt-1 text-warning">Son más de 300: se mandan los primeros 300. Volvé a mandar para el resto (los que ya lo jugaron quedan afuera solos).</div>}
            {preview.mode === 'mock' && <div className="mt-1 text-fg-3">WhatsApp está en modo prueba: los mensajes quedan en Mensajes, no salen de verdad.</div>}
            {!preview.dryRun && <div className="mt-1">Salieron {fmt.n(preview.sent ?? 0)}{preview.failed ? ` · fallaron ${fmt.n(preview.failed)}` : ''}.</div>}
          </div>
        )}
      </div>
    </Card>
  );
}
