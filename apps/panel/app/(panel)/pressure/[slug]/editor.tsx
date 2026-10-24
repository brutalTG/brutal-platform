'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Power, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm';
import { ActionButton, Checkbox, Field, FormDialog, Input, Select, Textarea } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { mediaUploadUrl, moveItem, saveItem, saveSettings, setExperimentStatus, toggleItem } from '@/lib/pressure-actions';

export type Section = 'calibration' | 'game' | 'rafaga';
export type Item = {
  id: string; section: Section; position: number; kind: string; prompt: string; screen_text: string | null;
  answer_type: string; follow_up: string | null; subthesis_id: string | null; source_note: string | null; enabled: boolean;
  follow_up_when: string; claim_yes: string | null; claim_no: string | null; option_a: string | null; option_b: string | null;
  media_url?: string | null; emoji_a?: string | null; emoji_b?: string | null; echo?: boolean; correct?: string | null;
};
export type Subthesis = { id: string; code: string; statement: string };

const KIND_OPTIONS = {
  game: [{ value: 'fun', label: 'Diversión: cultura, noticias, polémica' }, { value: 'signal', label: 'Señal: mide la tesis del estudio' }],
  calibration: [{ value: 'calibration', label: 'Verdad obligatoria (línea de base)' }, { value: 'obvious_lie', label: 'Mentira de control' }],
};
const ANSWERS = [
  { value: 'choice', label: 'Dilema: elige entre dos (hablando)' }, { value: 'yes_no', label: 'Sí o no' }, { value: 'agree', label: 'De acuerdo o no' },
  { value: 'number', label: 'Un número' }, { value: 'open', label: 'Libre' },
];

export function ItemDialog(props: {
  experimentId: string; section: Section; item?: Item; subtheses: Subthesis[]; trigger: React.ReactNode;
}) {
  if (props.section === 'rafaga') return <RafagaDialog {...props} />;
  return <VoiceDialog {...props} section={props.section} />;
}

function VoiceDialog({ experimentId, section, item, subtheses, trigger }: {
  experimentId: string; section: 'calibration' | 'game'; item?: Item; subtheses: Subthesis[]; trigger: React.ReactNode;
}) {
  const [kind, setKind] = React.useState(item?.kind ?? (section === 'game' ? 'fun' : 'calibration'));
  const [atype, setAtype] = React.useState(item?.answer_type ?? (section === 'game' ? 'choice' : 'open'));
  const choice = atype === 'choice';
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
              <Select name="answer_type" value={atype} onChange={(e) => setAtype(e.target.value)} options={ANSWERS} />
            </Field>
          </div>
          <Field label="Lo que dice la máquina" hint="Se lee en voz alta. Escribí los números en palabras si importa cómo suenan." error={err.prompt}>
            <Textarea name="prompt" defaultValue={item?.prompt} maxLength={400} required />
          </Field>
          {choice && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Opción A" hint="No se muestra: la máquina la usa para entender qué eligió. Escribila como la diría el jugador." error={err.option_a}>
                <Input name="option_a" defaultValue={item?.option_a ?? ''} maxLength={80} placeholder="Lo denuncio" />
              </Field>
              <Field label="Opción B" error={err.option_b}>
                <Input name="option_b" defaultValue={item?.option_b ?? ''} maxLength={80} placeholder="Lo cubro" />
              </Field>
            </div>
          )}
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
                  { value: 'always', label: 'Siempre' },
                  { value: 'yes', label: choice ? 'Si eligió A' : 'Si dijo sí / de acuerdo' },
                  { value: 'no', label: choice ? 'Si eligió B' : 'Si dijo no / en desacuerdo' },
                ]} />
              </Field>
            </div>
          )}
          {section === 'game' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={choice ? 'Si eligió A, dijo…' : 'Si dijo sí, dijo…'} hint='Para la acusación: "Mentiste cuando dijiste…"' error={err.claim_yes}>
                <Input name="claim_yes" defaultValue={item?.claim_yes ?? ''} maxLength={120} placeholder="que stalkeaste a un ex" />
              </Field>
              <Field label={choice ? 'Si eligió B, dijo…' : 'Si dijo no, dijo…'} error={err.claim_no}>
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

/** Una card de la ráfaga: texto o imagen/video, dos emojis. Puede volver por voz al final. */
function RafagaDialog({ experimentId, item, trigger }: { experimentId: string; item?: Item; subtheses: Subthesis[]; trigger: React.ReactNode }) {
  const [kind, setKind] = React.useState(item?.kind ?? 'flash');
  const [echo, setEcho] = React.useState(Boolean(item?.echo));
  const [atype, setAtype] = React.useState(item?.answer_type === 'choice' ? 'choice' : 'yes_no');
  const [media, setMedia] = React.useState(item?.media_url ?? '');
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const isVideo = /\.(mp4|webm|mov|m4v)($|\?)/i.test(media);

  async function upload(file: File) {
    setUploading(true); setUploadError(null);
    try {
      if (file.size > 25_000_000) throw new Error('Máximo 25 MB.');
      const r = await mediaUploadUrl(file.name, file.type);
      if (!r.ok) throw new Error(r.error);
      const res = await fetch(r.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!res.ok) throw new Error(`No se pudo subir (${res.status}).`);
      setMedia(r.publicUrl);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'No se pudo subir.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <FormDialog
      wide
      trigger={trigger}
      title={item ? `Editar ráfaga ${item.position}` : 'Nueva card de ráfaga'}
      description="Se ve 3 segundos y se contesta tocando un emoji. Sin voz y sin mentiras."
      submitLabel={item ? 'Guardar' : 'Agregar'}
      action={saveItem}
    >
      {(err) => (
        <>
          <input type="hidden" name="id" value={item?.id ?? ''} />
          <input type="hidden" name="experiment_id" value={experimentId} />
          <input type="hidden" name="section" value="rafaga" />
          <input type="hidden" name="media_url" value={media} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" error={err.kind}>
              <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} options={[
                { value: 'flash', label: 'Reacción: lo primero que te sale' }, { value: 'trap', label: 'Trampa: ¿está leyendo?' },
              ]} />
            </Field>
            {kind === 'trap' && (
              <Field label="Toque correcto" error={err.correct}>
                <Select name="correct" defaultValue={item?.correct ?? 'b'} options={[{ value: 'a', label: 'El primer emoji' }, { value: 'b', label: 'El segundo emoji' }]} />
              </Field>
            )}
          </div>
          <Field label="Texto en pantalla" hint="Corto y en mayúsculas. Si hay imagen o video, va encima." error={err.screen_text}>
            <Input name="screen_text" defaultValue={item?.screen_text ?? ''} maxLength={200} placeholder="LABURAR EN EL ESTADO" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Emoji 1" hint={echo ? 'Equivale a “sí” (o a la opción A) en la vuelta por voz.' : undefined} error={err.emoji_a}>
              <Input name="emoji_a" defaultValue={item?.emoji_a ?? ''} maxLength={16} className="text-xl" placeholder="🫡" />
            </Field>
            <Field label="Emoji 2" error={err.emoji_b}>
              <Input name="emoji_b" defaultValue={item?.emoji_b ?? ''} maxLength={16} className="text-xl" placeholder="🤮" />
            </Field>
          </div>
          <Field label="Imagen o video" hint="Opcional. Hasta 25 MB. El video se ve sin sonido y en loop." error={err.media_url ?? uploadError ?? undefined}>
            <div className="flex flex-wrap items-center gap-3">
              {media && (isVideo
                ? <video src={media} className="h-20 w-20 rounded object-cover" muted autoPlay loop playsInline />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={media} alt="" className="h-20 w-20 rounded object-cover" />)}
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border border-border-strong px-3 text-sm text-fg-2 hover:bg-sunken">
                <Upload className="size-4" />{uploading ? 'Subiendo…' : media ? 'Cambiar' : 'Subir archivo'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              </label>
              {media && <Button type="button" variant="ghost" size="sm" onClick={() => setMedia('')}>Quitar</Button>}
            </div>
          </Field>
          {kind === 'flash' && (
            <Checkbox name="echo" label="Vuelve al final por voz (ahí se puede mentir)" checked={echo} onChange={(e) => setEcho(e.target.checked)} />
          )}
          {echo && kind === 'flash' && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Lo que pregunta la máquina en la vuelta" className="sm:col-span-2" error={err.prompt}>
                  <Textarea name="prompt" defaultValue={item?.echo ? item.prompt : ''} maxLength={400} placeholder="¿Te gustaría laburar en el Estado? Sí o no." />
                </Field>
                <Field label="Cómo se responde" error={err.answer_type}>
                  <Select name="answer_type" value={atype} onChange={(e) => setAtype(e.target.value)} options={[{ value: 'yes_no', label: 'Sí o no' }, { value: 'choice', label: 'Elige entre dos' }]} />
                </Field>
              </div>
              {atype === 'choice' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Opción A (emoji 1)" error={err.option_a}><Input name="option_a" defaultValue={item?.option_a ?? ''} maxLength={80} /></Field>
                  <Field label="Opción B (emoji 2)" error={err.option_b}><Input name="option_b" defaultValue={item?.option_b ?? ''} maxLength={80} /></Field>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={atype === 'choice' ? 'Si eligió A, dijo…' : 'Si dijo sí, dijo…'} hint='Para la acusación: "Mentiste cuando dijiste…"' error={err.claim_yes}>
                  <Input name="claim_yes" defaultValue={item?.claim_yes ?? ''} maxLength={120} />
                </Field>
                <Field label={atype === 'choice' ? 'Si eligió B, dijo…' : 'Si dijo no, dijo…'} error={err.claim_no}>
                  <Input name="claim_no" defaultValue={item?.claim_no ?? ''} maxLength={120} />
                </Field>
              </div>
              <Field label="Repregunta" hint="Opcional." error={err.follow_up}>
                <Input name="follow_up" defaultValue={item?.follow_up ?? ''} maxLength={300} />
              </Field>
            </>
          )}
          <Field label="Fuente del dato" hint="Solo para el equipo.">
            <Input name="source_note" defaultValue={item?.source_note ?? ''} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

export function AddItemButton(props: { experimentId: string; section: Section; subtheses: Subthesis[] }) {
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
  pitch?: string[]; screens?: { entry_note?: string; consent?: string; consent_note?: string }; rules: { lies: number; win_max_caught: number }; rewards: { per_answer: number; max: number; win_bonus: number };
  voice: { voice_id: string; fallback_voice_id?: string }; lines: Record<string, string | string[]>;
  stages?: { rafaga?: boolean; hilo?: boolean; vuelta?: boolean }; rafaga?: { seconds?: number }; hilo?: { multipliers?: number[] };
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
      {section('Etapas', 'Lo que rompe el ritmo de las preguntas con voz. Se prenden y apagan para probar combinaciones.', (
        <>
          <div className="grid gap-2">
            <Checkbox name="stage_rafaga" label="Ráfaga al tacto después de calibrar" defaultChecked={def.stages?.rafaga ?? false} />
            <Checkbox name="stage_vuelta" label="La vuelta: las cards marcadas vuelven por voz al final" defaultChecked={def.stages?.vuelta ?? false} />
            <Checkbox name="stage_hilo" label="Mayor o menor en la mitad del juego (multiplica los tickets)" defaultChecked={def.stages?.hilo ?? false} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Segundos por card de ráfaga" error={errors.rafaga_seconds}><Input name="rafaga_seconds" inputMode="decimal" defaultValue={String(def.rafaga?.seconds ?? 3).replace('.', ',')} /></Field>
            <Field label="Multiplicadores de mayor o menor" hint="Uno por acierto, de menor a mayor." error={errors.ladder}>
              <Input name="ladder" defaultValue={(def.hilo?.multipliers ?? [1.5, 2, 3, 5, 10]).map((x) => String(x).replace('.', ',')).join(' ')} />
            </Field>
          </div>
        </>
      ))}
      {section('Recompensas', 'Golden Tickets. Se cobran una sola vez por nodo; las revanchas no pagan.', (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Por respuesta" error={errors.per_answer}><Input name="per_answer" type="number" min={0} defaultValue={def.rewards.per_answer} /></Field>
          <Field label="Máximo por llegar al final" error={errors.max}><Input name="max" type="number" min={0} defaultValue={def.rewards.max} /></Field>
          <Field label="Extra si gana" error={errors.win_bonus}><Input name="win_bonus" type="number" min={0} defaultValue={def.rewards.win_bonus} /></Field>
        </div>
      ))}
      {section('Pantalla de entrada', 'Lo único que lee antes de jugar: al tocar Entrar se activa el micrófono y arranca. *Así* va en negrita; un salto de línea corta la frase.', (
        <>
          <Field label="Texto principal" hint="Hasta tres bloques. Debajo se muestra el premio en tickets." error={errors.pitch1}>
            <div className="grid gap-2">
              <Textarea name="pitch1" className="min-h-[56px]" defaultValue={def.pitch?.[0] ?? ''} aria-label="Bloque 1" />
              <Textarea name="pitch2" className="min-h-[56px]" defaultValue={def.pitch?.[1] ?? ''} aria-label="Bloque 2" />
              <Textarea name="pitch3" className="min-h-[56px]" defaultValue={def.pitch?.[2] ?? ''} aria-label="Bloque 3" />
            </div>
          </Field>
          <Field label="Debajo del premio" hint="Ej: 3 minutos. Al entrar se activa el micrófono."><Input name="consent_note" defaultValue={def.screens?.consent_note ?? ''} /></Field>
          <Field label="Letra chica debajo de Entrar" hint="Que diga que es anónimo y que las respuestas quedan grabadas."><Input name="entry_note" defaultValue={def.screens?.entry_note ?? ''} /></Field>
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
            <Field label="Antes de la ráfaga"><Input name="rafaga_start" defaultValue={l.rafaga_start ?? ''} /></Field>
            <Field label="Antes de la vuelta"><Input name="vuelta_start" defaultValue={l.vuelta_start ?? ''} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Antes de mayor o menor"><Textarea name="hilo_start" defaultValue={l.hilo_start ?? ''} /></Field>
            <Field label="Después de mayor o menor"><Input name="hilo_end" defaultValue={l.hilo_end ?? ''} /></Field>
          </div>
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
