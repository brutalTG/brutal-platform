'use client';
// ============================================================
// PANEL STORE — misma interfaz que el armador del sandbox, pero la fuente de verdad es la base.
// La pantalla lee de una copia en memoria (cargada al abrir) y cada cambio se guarda en orden
// en drops.* por acciones del servidor. Si algo falla, se avisa y se puede recargar.
// ============================================================

import type { Question, Drop, RevealArchetype, RevealScoringConfig, MultiplierCheckpoint, SplashConfig } from "./drop-types";
import {
  saveQuestion as saveQuestionAction,
  removeQuestion as removeQuestionAction,
  saveDrop as saveDropAction,
  removeDrop as removeDropAction,
  publishDrop as publishDropAction,
  previewLink,
  listSegments,
  listDimensions,
} from "@/lib/experiments-actions";

export interface PanelQuestion {
  id: string;
  data: Question;
  label: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type DropStatus = "draft" | "active" | "archived";

export interface PanelDrop {
  id: string;
  name: string;
  dropId: string;
  status: DropStatus;
  timeoutMessage: string;
  multiplierCheckpoints: Record<string, MultiplierCheckpoint>;
  reveal: { title: string; description: string; archetypes: RevealArchetype[]; scoring?: RevealScoringConfig };
  questionIds: string[];
  disabledQuestionIds?: string[];
  splash?: SplashConfig;
  segmentIds?: string[];
  lastPublishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileDimension {
  dimensionId: string;
  slug: string;
  name: string;
  description: string;
  valueType: "categorical" | "scale";
  stability: "stable" | "evolving";
  scaleMin: number | null;
  scaleMax: number | null;
  isActive: boolean;
}

// ---------- Copia en memoria ----------
let questions: PanelQuestion[] = [];
let drops: PanelDrop[] = [];

export function hydrate(data: { questions: PanelQuestion[]; drops: PanelDrop[] }) {
  questions = data.questions;
  drops = data.drops;
}

// ---------- Guardado en orden ----------
export type SaveState = { pending: number; error: string | null };
let state: SaveState = { pending: 0, error: null };
const listeners = new Set<(s: SaveState) => void>();
const setState = (s: Partial<SaveState>) => { state = { ...state, ...s }; listeners.forEach((l) => l(state)); };
export const onSaveState = (l: (s: SaveState) => void) => { listeners.add(l); l(state); return () => { listeners.delete(l); }; };
export const clearSaveError = () => setState({ error: null });

let chain: Promise<unknown> = Promise.resolve();
const queued = new Set<string>();

/** Encola una escritura. Si ya hay una igual esperando, no se repite: la que corre manda el estado más nuevo. */
function enqueue<T extends { ok: boolean; error?: string }>(key: string | null, run: () => Promise<T>): Promise<T | null> {
  if (key && queued.has(key)) return chain.then(() => null);
  if (key) queued.add(key);
  setState({ pending: state.pending + 1 });
  const p = chain.then(async () => {
    if (key) queued.delete(key);
    try {
      const r = await run();
      if (!r.ok) setState({ error: r.error ?? "No se pudo guardar." });
      return r;
    } catch {
      setState({ error: "Se cortó la conexión con el servidor. Recargá la página antes de seguir." });
      return { ok: false, error: "network" } as unknown as T;
    } finally {
      setState({ pending: state.pending - 1 });
    }
  });
  chain = p.catch(() => {});
  return p;
}

const queueQuestion = (id: string) => enqueue(`q:${id}`, async () => {
  const q = questions.find((x) => x.id === id);
  return q ? saveQuestionAction(q as any) : { ok: true as const };
});
const queueDrop = (id: string) => enqueue(`d:${id}`, async () => {
  const d = drops.find((x) => x.id === id);
  return d ? saveDropAction({ ...d, disabledQuestionIds: d.disabledQuestionIds ?? [] } as any) : { ok: true as const };
});

// ---------- Helpers ----------
const generateId = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "drop";
const newSlug = (name: string) => `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
const defaultLabel = (data: Question) => data.type + " — " + ("text" in data ? (data as any).text?.slice(0, 40) || "Sin texto" : "Sin texto");

function sanitizeSegmentIds(ids: any): string[] | undefined {
  if (!Array.isArray(ids)) return undefined;
  const clean = ids.filter((s: any) => s != null && s !== "");
  return clean.length > 0 ? clean : undefined;
}

// ---------- Cartas ----------
export function getQuestions(): PanelQuestion[] {
  return [...questions];
}

export function getQuestionById(id: string): PanelQuestion | undefined {
  return questions.find((q) => q.id === id);
}

export function createQuestion(data: Question, label?: string, tags?: string[]): PanelQuestion {
  const q: PanelQuestion = { id: generateId(), data, label: label || defaultLabel(data), tags: tags || [], createdAt: now(), updatedAt: now() };
  questions = [...questions, q];
  queueQuestion(q.id);
  return q;
}

export function updateQuestion(id: string, data: Partial<Question>, label?: string, tags?: string[]): PanelQuestion | null {
  const idx = questions.findIndex((q) => q.id === id);
  if (idx === -1) return null;
  const merged = { ...questions[idx].data, ...data } as any;
  const seg = sanitizeSegmentIds(merged.segmentIds);
  if (seg) merged.segmentIds = seg; else delete merged.segmentIds;
  const next: PanelQuestion = {
    ...questions[idx], data: merged as Question,
    ...(label !== undefined ? { label } : {}), ...(tags !== undefined ? { tags } : {}), updatedAt: now(),
  };
  questions = questions.map((q, i) => (i === idx ? next : q));
  queueQuestion(id);
  return next;
}

export function deleteQuestion(id: string): boolean {
  if (!questions.some((q) => q.id === id)) return false;
  questions = questions.filter((q) => q.id !== id);
  const touched: string[] = [];
  drops = drops.map((d) => {
    if (!d.questionIds.includes(id)) return d;
    touched.push(d.id);
    return { ...d, questionIds: d.questionIds.filter((x) => x !== id), disabledQuestionIds: (d.disabledQuestionIds ?? []).filter((x) => x !== id) };
  });
  enqueue(null, () => removeQuestionAction(id));
  touched.forEach(queueDrop);
  return true;
}

export function duplicateQuestion(id: string): PanelQuestion | null {
  const original = questions.find((q) => q.id === id);
  if (!original) return null;
  const dup: PanelQuestion = { ...clone(original), id: generateId(), label: original.label + " (copia)", createdAt: now(), updatedAt: now() };
  questions = [...questions, dup];
  queueQuestion(dup.id);
  return dup;
}

// ---------- Drops ----------
export function getDrops(): PanelDrop[] {
  return [...drops];
}

export function getDropById(id: string): PanelDrop | undefined {
  return drops.find((d) => d.id === id);
}

export function createDrop(name: string): PanelDrop {
  const drop: PanelDrop = {
    id: generateId(), name, dropId: newSlug(name), status: "draft",
    timeoutMessage: "Brutal eligió por vos.", multiplierCheckpoints: {},
    reveal: { title: "Tu perfil\nde señal", description: "", archetypes: [] },
    questionIds: [], createdAt: now(), updatedAt: now(),
  };
  drops = [...drops, drop];
  queueDrop(drop.id);
  return drop;
}

export function updateDrop(id: string, updates: Partial<PanelDrop>): PanelDrop | null {
  const idx = drops.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const next = { ...drops[idx], ...updates, updatedAt: now() };
  drops = drops.map((d, i) => (i === idx ? next : d));
  queueDrop(id);
  return next;
}

export function deleteDrop(id: string): boolean {
  if (!drops.some((d) => d.id === id)) return false;
  drops = drops.filter((d) => d.id !== id);
  enqueue(null, () => removeDropAction(id));
  return true;
}

export function duplicateDrop(id: string): PanelDrop | null {
  const original = drops.find((d) => d.id === id);
  if (!original) return null;
  const dup: PanelDrop = {
    ...clone(original), id: generateId(), dropId: newSlug(original.name), name: original.name + " (copia)",
    status: "draft", lastPublishedAt: undefined, createdAt: now(), updatedAt: now(),
  };
  drops = [...drops, dup];
  queueDrop(dup.id);
  return dup;
}

/** Solo cambia la vista. Lo publica de verdad publishDropNow. */
export function activateDrop(id: string): PanelDrop | null {
  if (!drops.some((d) => d.id === id)) return null;
  drops = drops.map((d) => (d.id === id ? { ...d, status: "active" } : d.status === "active" ? { ...d, status: "archived" } : d));
  return drops.find((d) => d.id === id)!;
}

/** Espera que se guarde todo lo pendiente y publica el Drop: pasa a ser el que juegan todos. */
export async function publishDropNow(id: string): Promise<boolean> {
  const r = await enqueue(null, () => publishDropAction(id));
  if (!r?.ok) return false;
  const at = (r as any).publishedAt ?? now();
  drops = drops.map((d) => (d.id === id ? { ...d, status: "active", lastPublishedAt: at } : d.status === "active" ? { ...d, status: "archived" } : d));
  return true;
}

/** Guarda lo pendiente del Drop y devuelve si quedó guardado. */
export async function syncDropNow(id: string): Promise<{ ok: boolean; error?: string }> {
  clearSaveError();
  queueDrop(id);
  await chain;
  return state.error ? { ok: false, error: state.error } : { ok: true };
}

/** Link para probarlo en el teléfono como jugador (no acredita premios). */
export async function previewDrop(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const d = drops.find((x) => x.id === id);
  if (!d) return { ok: false, error: "Drop no encontrado" };
  queueDrop(id);
  await chain;
  if (state.error) return { ok: false, error: state.error };
  return previewLink(d.dropId);
}

// ---------- Segmentos y dimensiones del perfil ----------
let segmentsCache: Promise<{ segmentId: string; name: string; matchingCount: number }[]> | null = null;
let dimensionsCache: Promise<ProfileDimension[]> | null = null;
export const fetchSegments = () => (segmentsCache ??= listSegments().catch(() => []));
export const fetchDimensions = () => (dimensionsCache ??= (listDimensions() as Promise<ProfileDimension[]>).catch(() => []));

// ---------- Exportar / importar JSON ----------
export function exportDropJSON(drop: PanelDrop, allQuestions: PanelQuestion[]): Drop {
  const map = new Map(allQuestions.map((q) => [q.id, q]));
  const disabled = new Set(drop.disabledQuestionIds || []);
  const ordered: Question[] = drop.questionIds
    .filter((id) => !disabled.has(id))
    .map((id) => map.get(id))
    .filter((q): q is PanelQuestion => q !== undefined)
    .map((q) => ({ ...q.data, questionId: q.id }) as unknown as Question);
  const result: Drop = {
    id: drop.dropId, name: drop.name, version: 1, timeoutMessage: drop.timeoutMessage,
    multiplierCheckpoints: drop.multiplierCheckpoints, reveal: drop.reveal, questions: ordered,
  };
  if (drop.splash) result.splash = drop.splash;
  if (drop.segmentIds && drop.segmentIds.length > 0) result.segmentIds = drop.segmentIds;
  return result;
}

export function importDropJSON(dropJson: Drop): { drop: PanelDrop; questions: PanelQuestion[] } {
  const imported: PanelQuestion[] = dropJson.questions.map((q) => {
    const { questionId: _drop, ...data } = q as any;
    return { id: generateId(), data, label: defaultLabel(q), tags: ["imported"], createdAt: now(), updatedAt: now() };
  });
  questions = [...questions, ...imported];
  imported.forEach((q) => queueQuestion(q.id));
  const drop: PanelDrop = {
    id: generateId(), name: dropJson.name, dropId: newSlug(dropJson.name), status: "draft",
    timeoutMessage: dropJson.timeoutMessage || "Brutal eligió por vos.",
    multiplierCheckpoints: dropJson.multiplierCheckpoints || {},
    reveal: { title: dropJson.reveal.title, description: dropJson.reveal.description, archetypes: dropJson.reveal.archetypes || [], scoring: dropJson.reveal.scoring },
    questionIds: imported.map((q) => q.id),
    ...(dropJson.splash ? { splash: dropJson.splash } : {}),
    createdAt: now(), updatedAt: now(),
  };
  drops = [...drops, drop];
  queueDrop(drop.id);
  return { drop, questions: imported };
}

// ---------- Tipos de carta ----------
export type QuestionType = Question["type"];

export const QUESTION_TYPE_CATEGORIES: Record<string, { label: string; types: QuestionType[] }> = {
  basic: { label: "Básico", types: ["choice", "slider", "confesionario"] },
  visual: { label: "Visual", types: ["choice_emoji", "choice_hybrid", "slider_emoji", "binary_media", "hot_take_visual", "media_reaction"] },
  interactive: { label: "Interactivo", types: ["ranking", "prediction_bet", "rafaga", "rafaga_emoji", "rafaga_burst", "hot_take"] },
  special: { label: "Especial", types: ["trap", "trap_silent", "dead_drop"] },
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  choice: "Elegir", prediction_bet: "Apuesta", ranking: "Ordenar", confesionario: "Confesionario",
  slider: "Escala", binary_media: "Imagen A/B", rafaga: "Ráfaga", dead_drop: "Dead Drop",
  trap: "Trampa", hot_take: "Hot Take", trap_silent: "Trampa silenciosa", choice_emoji: "Elegir emoji",
  choice_hybrid: "Elegir mixto", slider_emoji: "Escala emoji", rafaga_emoji: "Ráfaga emoji",
  hot_take_visual: "Hot Take visual", media_reaction: "Reacción a imagen", rafaga_burst: "Ráfaga con imagen o video",
};

export const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  choice: "🔘", prediction_bet: "🎰", ranking: "📊", confesionario: "🤫", slider: "🎚️",
  binary_media: "🖼️", rafaga: "⚡", dead_drop: "💀", trap: "🪤", hot_take: "🔥",
  trap_silent: "🕵️", choice_emoji: "😀", choice_hybrid: "💬", slider_emoji: "🫠",
  rafaga_emoji: "⚡😀", hot_take_visual: "🔥🖼️", media_reaction: "📸", rafaga_burst: "💥⚡",
};

export function getDefaultQuestionData(type: QuestionType): Question {
  const base = { timer: 15 };
  switch (type) {
    case "choice": return { ...base, type: "choice", text: "", options: ["", ""] };
    case "choice_emoji": return { ...base, type: "choice_emoji", text: "", options: ["😀", "😢"] };
    case "choice_hybrid": return { ...base, type: "choice_hybrid", text: "", options: ["", ""] };
    case "slider": return { ...base, type: "slider", text: "", min: 0, max: 10, labelLeft: "Nada", labelRight: "Totalmente" };
    case "slider_emoji": return { ...base, type: "slider_emoji", text: "", min: 0, max: 10, labelLeft: "🫣", labelRight: "😏" };
    case "confesionario": return { ...base, timer: 30, type: "confesionario", text: "" };
    case "prediction_bet": return { ...base, type: "prediction_bet", text: "", optionA: "", optionB: "", maxTickets: 100 };
    case "ranking": return { ...base, type: "ranking", text: "", options: ["", "", ""] };
    case "binary_media": return { ...base, type: "binary_media", imageUrl: "", optionA: "", optionB: "" };
    case "rafaga": return { ...base, timer: 0, type: "rafaga", prompt: "", promptBold: "", items: [{ text: "", optionA: "", optionB: "" }], secondsPerItem: 3 };
    case "rafaga_emoji": return { ...base, timer: 0, type: "rafaga_emoji", prompt: "", promptBold: "", items: [{ text: "", optionA: "😀", optionB: "😢" }], secondsPerItem: 3 };
    case "rafaga_burst": return {
      ...base, timer: 0, type: "rafaga_burst",
      preScreen: { title: "RÁFAGA", subtitle: "Respondé rápido", durationMs: 2500 },
      items: [{ trigger: { type: "text", text: "" }, interaction: { type: "emoji_binary", emojiA: "👍", emojiB: "👎" } }],
      secondsPerItem: 3,
    };
    case "hot_take": return { ...base, type: "hot_take", text: "", options: ["", ""] };
    case "hot_take_visual": return { ...base, type: "hot_take_visual", text: "", options: ["", ""] };
    case "trap": return { ...base, type: "trap", text: "", options: ["", ""], correctIndex: 0, penalty: 50 };
    case "trap_silent": return { ...base, type: "trap_silent", text: "", options: ["", ""], correctIndex: 0, penalty: 25 };
    case "dead_drop": return { ...base, timer: 0, type: "dead_drop", firstLine: "", codeLines: [""], lastLines: [""] };
    case "media_reaction": return { ...base, type: "media_reaction", imageUrl: "", text: "", mode: "emoji", options: ["😍", "🤮"] };
    default: return { ...base, type: "choice", text: "", options: ["", ""] };
  }
}
