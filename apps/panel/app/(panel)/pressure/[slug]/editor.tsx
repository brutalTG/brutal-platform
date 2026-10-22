'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Power } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm';
import { ActionButton, Field, FormDialog, Input, Select, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { moveItem, saveItem, saveSettings, setExperimentStatus, toggleItem } from '@/lib/pressure-actions';

export type Item = {
  id: string; section: 'calibration' | 'game'; position: number; kind: string; prompt: string; screen_text: string | null;
  answer_type: string; follow_up: string | null; subthesis_id: string | null; source_note: string | null; enabled: boolean;
  follow_up_when: string; claim_yes: string | null; claim_no: string | null;
};
export type Subthesis = { id: string; code: string; statement: string };

const KIND_OPTIONS = {
  game: [{ value: 'fun', label: 'Diversión: cultura, noticias, polémica' }, { value: 'signal', label: 'Señal: mide la tesis del estudio' }],
  calibration: [{ value: 'calibration', label: 'Verdad obligatoria (línea de base)' }, { value: 'obvious_lie', label: 'Mentira de control' }],
};
const ANSWERS = [
  { value: 'yes_no', label: 'Sí o no' }, { value: 'agree', label: 'De acuerdo o no' },
  { value: 'number', label: 'Un número' }, { value: 'open', label: 'Libre' },
];

export function ItemDialog({ experimentId, section, item, subtheses, trigger }: {
  experimentId: string; section: 'calibration' | 'game'; item?: Item; subtheses: Subthesis[]; trigger: React.ReactNode;
}) {
  const [kind, setKind] = React.useState(item?.kind ?? (section === 'game' ? 'fun' : 'calibration'));
  return (
    <FormDialog
      wide
      trigger={trigger}
      title={item ? `Editar pregunta ${item.position}` : section === 'game' ? 'Nueva pregunta' : 'Nueva pregunta de calibración'}
      description={item ? 'Las partidas en curso siguen con la versión anterior.' : 'Se agrega al final de la lista. Después la podés mover.'}
      submitLabel={item ? 'Guardar' : 'Agregar'}
      action={saveItem}
    >
      {(err) => (
        <>
          <input type="hidden" name="id" value={item?.id ?? ''} />
          <input type="hidden" name="experiment_id" value={experimentId} />
          <input type="hidden" name="section" value={section} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" error={err.kind}>
              <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} options={KIND_OPTIONS[section]} />
            </Field>
            <Field label="Cómo se responde" error={err.answer_type}>
              <Select name="answer_type" defaultValue={item?.answer_type ?? (section === 'game' ? 'yes_no' : 'open')} options={ANSWERS} />
            </Field>
          </div>
          <Field label="Lo que dice la máquina" hint="Se lee en voz alta. Escribí los números en palabras si importa cómo suenan." error={err.prompt}>
            <Textarea name="prompt" defaultValue={item?.prompt} maxLength={400} required />
          </Field>
          <Field label="Texto en pantalla" hint="Versión corta para leer. Si queda vacío, se muestra lo que dice la máquina." error={err.screen_text}>
            <Input name="screen_text" defaultValue={item?.screen_text ?? ''} maxLength={200} />
          </Field>
          {section === 'game' && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Repregunta" hint="Opcional. Va con la misma verdad o mentira." error={err.follow_up} className="sm:col-span-2">
                <Input name="follow_up" defaultValue={item?.follow_up ?? ''} maxLength={300} placeholder="¿Por qué?" />
              </Field>
              <Field label="Cuándo la hace" error={err.follow_up_when}>
                <Select name="follow_up_when" defaultValue={item?.follow_up_when ?? 'always'} options={[
                  { value: 'always', label: 'Siempre' }, { value: 'yes', label: 'Si dijo sí / de acuerdo' }, { value: 'no', label: 'Si dijo no / en desacuerdo' },
                ]} />
              </Field>
            </div>
          )}
          {section === 'game' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Si dijo sí, dijo…" hint='Para la acusación: "Mentiste cuando dijiste…"' error={err.claim_yes}>
                <Input name="claim_yes" defaultValue={item?.claim_yes ?? ''} maxLength={120} placeholder="que stalkeaste a un ex" />
              </Field>
              <Field label="Si dijo no, dijo…" error={err.claim_no}>
                <Input name="claim_no" defaultValue={item?.claim_no ?? ''} maxLength={120} placeholder="que no stalkeaste a ningún ex" />
              </Field>
            </div>
          )}
          {kind === 'signal' && (
            <Field label="Sub-tesis que mide" error={err.subthesis_id}>
              <Select name="subthesis_id" defaultValue={item?.subthesis_id ?? ''} options={[{ value: '', label: 'Elegí una…' }, ...subtheses.map((s) => ({ value: s.id, label: `${s.code} · ${s.statement}` }))]} />
            </Field>
          )}
          {section === 'game' && (
            <Field label="Fuente del dato" hint="Solo para el equipo: de dónde sale la noticia o el número, con fecha.">
              <Input name="source_note" defaultValue={item?.source_note ?? ''} />
            </Field>
          )}
        </>
      )}
    </FormDialog>
  );
}

export function AddItemButton(props: { experimentId: string; section: 'calibration' | 'game'; subtheses: Subthesis[] }) {
  return <ItemDialog {...props} trigger={<Button variant={props.section === 'game' ? 'primary' : 'secondary'} icon={<Plus />}>{props.section === 'game' ? 'Agregar pregunta' : 'Agregar'}</Button>} />;
}

export function ItemActions({ item, first, last, experimentId, subtheses }: { item: Item; first: boolean; last: boolean; experimentId: string; subtheses: Subthesis[] }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton variant="ghost" size="icon" aria-label="Subir" title="Subir" disabled={first} action={() => moveItem(item.id, -1)} icon={<ArrowUp />} />
      <ActionButton variant="ghost" size="icon" aria-label="Bajar" title="Bajar" disabled={last} action={() => moveItem(item.id, 1)} icon={<ArrowDown />} />
      <ActionButton variant="ghost" size="icon" aria-label={item.enabled ? 'Apagar' : 'Prender'} title={item.enabled ? 'Apagar' : 'Prender'}
        action={() => toggleItem(item.id, !item.enabled)} icon={item.enabled ? <EyeOff /> : <Eye />} />
      <ItemDialog experimentId={experimentId} section={item.section} item={item} subtheses={subtheses}
        trigger={<Button variant="ghost" size="icon" aria-label="Editar" title="Editar" icon={<Pencil />} />} />
    </div>
  );
}

export function StatusControl({ id, status }: { id: string; status: string }) {
  if (status === 'draft' || status === 'retired') {
    return (
      <ConfirmAction
        trigger={<Button variant="primary" icon={<Power />}>Abrir para test</Button>}
        title="Abrir el juego"
        description="Los invitados que escriban por WhatsApp van a poder jugar."
        confirmLabel="Abrir"
        action={() => setExperimentStatus(id, 'testing')}
      />
    );
  }
  return (
    <ConfirmAction
      trigger={<Button variant="danger-outline" icon={<Power />}>Cerrar el juego</Button>}
      title="Cerrar el juego"
      description="Nadie más va a poder empezar una partida. Las que están en curso pueden terminar. Se puede volver a abrir."
      confirmLabel="Cerrar"
      tone="danger"
      action={() => setExperimentStatus(id, 'draft')}
    />
  );
}

type Def = {
  pitch?: string[]; rules: { lies: number; win_max_caught: number }; rewards: { per_answer: number; max: number; win_bonus: number };
  voice: { voice_id: string; fallback_voice_id?: string }; lines: Record<string, string | string[]>;
};

export function SettingsForm({ experimentId, def }: { experimentId: string; def: Def }) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const [dirty, setDirty] = React.useState(false);
  const toast = useToast();
  const router = useRouter();
  const l = def.lines as Record<string, string>;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setErrors({}); setError(null);
    start(async () => {
      const r = await saveSettings(data);
      if (r.ok) { toast.show(r.message ?? 'Guardado'); setDirty(false); router.refresh(); }
      else { setError(r.error); setErrors(r.fields ?? {}); }
    });
  }

  const section = (title: string, desc: string, children: React.ReactNode) => (
    <section className="grid gap-4 border-b border-border px-4 py-5 last:border-0 lg:grid-cols-3">
      <div><h3 className="text-md font-semibold text-fg">{title}</h3><p className="mt-1 text-sm text-fg-3">{desc}</p></div>
      <div className="grid gap-4 lg:col-span-2">{children}</div>
    </section>
  );

  return (
    <form onSubmit={submit} onChange={() => setDirty(true)} className="rounded-md border border-border bg-surface shadow-card" noValidate>
      <input type="hidden" name="experiment_id" value={experimentId} />
      {section('Reglas', 'Cuántas mentiras y cuándo gana el jugador.', (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mentiras por partida" error={errors.lies}><Input name="lies" type="number" min={1} defaultValue={def.rules.lies} /></Field>
          <Field label="Gana si la máquina agarra como mucho" hint="0 = gana solo si no le agarra ninguna." error={errors.win_max_caught}>
            <Input name="win_max_caught" type="number" min={0} defaultValue={def.rules.win_max_caught} />
          </Field>
        </div>
      ))}
      {section('Recompensas', 'Golden Tickets. Se cobran una sola vez por nodo; las revanchas no pagan.', (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Por respuesta" error={errors.per_answer}><Input name="per_answer" type="number" min={0} defaultValue={def.rewards.per_answer} /></Field>
          <Field label="Máximo por llegar al final" error={errors.max}><Input name="max" type="number" min={0} defaultValue={def.rewards.max} /></Field>
          <Field label="Extra si gana" error={errors.win_bonus}><Input name="win_bonus" type="number" min={0} defaultValue={def.rewards.win_bonus} /></Field>
        </div>
      ))}
      {section('El desafío en 3 frases', 'Lo que se lee al entrar.', (
        <>
          <Input name="pitch1" defaultValue={def.pitch?.[0] ?? ''} aria-label="Frase 1" />
          <Input name="pitch2" defaultValue={def.pitch?.[1] ?? ''} aria-label="Frase 2" />
          <Input name="pitch3" defaultValue={def.pitch?.[2] ?? ''} aria-label="Frase 3" />
        </>
      ))}
      {section('Voz', 'ID de la voz en ElevenLabs (Voices → elegís una → ⋯ → Copy voice ID). Si la principal falla, usa la de respaldo.', (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Voz principal" error={errors.voice_id}><Input name="voice_id" defaultValue={def.voice.voice_id} className="font-mono" /></Field>
          <Field label="Voz de respaldo"><Input name="fallback_voice_id" defaultValue={def.voice.fallback_voice_id ?? ''} className="font-mono" /></Field>
        </div>
      ))}
      {section('Frases de la máquina', 'Cortas y en voz alta. Nunca "cachado".', (
        <>
          <Field label="Presentación"><Textarea name="intro" defaultValue={l.intro} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Antes de calibrar"><Textarea name="calibration_start" defaultValue={l.calibration_start} /></Field>
            <Field label="Después de calibrar"><Textarea name="calibration_end" defaultValue={l.calibration_end} /></Field>
          </div>
          <Field label="Arranca el juego"><Textarea name="game_start" defaultValue={l.game_start} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Si no entendió"><Input name="unclear" defaultValue={l.unclear} /></Field>
            <Field label="Si no escuchó"><Input name="not_heard" defaultValue={l.not_heard} /></Field>
          </div>
          <Field label="Acusación" hint="{claims} se reemplaza por lo que dijo en las que acusa: “que stalkeaste a un ex y que…”." error={errors.accusation}>
            <Input name="accusation" defaultValue={l.accusation} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Si gana el jugador"><Input name="win" defaultValue={l.win} /></Field>
            <Field label="Si gana la máquina"><Input name="lose" defaultValue={l.lose} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pantalla final si gana el jugador"><Input name="result_escaped" defaultValue={l.result_escaped ?? 'SOS UN GRAN MENTIROSO'} /></Field>
            <Field label="Pantalla final si gana la máquina"><Input name="result_caught" defaultValue={l.result_caught ?? 'NO TE DA PARA MENTIRLE A UNA IA'} /></Field>
          </div>
        </>
      ))}
      <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-md border-t border-border bg-surface/95 px-4 py-3 backdrop-blur">
        {error && <p role="alert" className="mr-auto text-sm text-danger">{error}</p>}
        {!error && dirty && <p className="mr-auto text-sm text-fg-3">Hay cambios sin guardar.</p>}
        <Button type="submit" variant="primary" loading={pending} disabled={!dirty}>Guardar ajustes</Button>
      </div>
    </form>
  );
}
