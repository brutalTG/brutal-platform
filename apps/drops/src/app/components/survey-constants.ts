// ============================================================
// SURVEY CONSTANTS — Pure helpers & constants for SurveyApp
// ============================================================

import type { Question } from "./drop-types";

export const REWARD_ANIM_MS = 900;
export const REACTION_MS = 700;

// --- Action hint per question type ---
const ACTION_HINTS: Partial<Record<Question["type"], string>> = {
  choice: "Elegí una",
  choice_emoji: "Reaccioná",
  choice_hybrid: "Elegí una",
  prediction_bet: "Apostá",
  ranking: "Ordená",
  confesionario: "Confesionario",
  slider: "Deslizá",
  slider_emoji: "Deslizá",
  trap: "Elegí una",
  trap_silent: "Elegí una",
  hot_take: "Hot take",
  hot_take_visual: "Hot take",
  binary_media: "Elegí una",
  rafaga: "Rafaga",
  rafaga_emoji: "Rafaga",
  voice: "Hablá",
  mayor_menor: "Mayor o menor",
};

/** La consigna de la carta y, si paga tickets, cuánto: "Elegí una · +20 🎟". */
export function getActionHint(q: Question): string {
  const base = ACTION_HINTS[q.type] ?? "";
  const r = (q as { reward?: { type: string; value: number } }).reward;
  if (!r || r.type !== "tickets" || !(r.value > 0)) return base;
  return base ? `${base} · +${r.value} 🎟` : `+${r.value} 🎟`;
}

// --- Tonal variation: timeout messages ---
const TIMEOUT_POOL = [
  "Brutal eligió por vos. De nada.",
  "El silencio también es respuesta. Pero no suma.",
  "Se te acabó el tiempo.",
  "Tarde. Siguiente.",
  "Timeout. Input descartado.",
  "Sin respuesta. Avanzando.",
  "La no-respuesta también es dato.",
  "Dudar tanto es una forma de responder.",
  "Brutal eligió por vos.",
];

export function pickTimeoutMessage(): string {
  return TIMEOUT_POOL[Math.floor(Math.random() * TIMEOUT_POOL.length)];
}

// --- Question types that have options arrays (for scoring map) ---
const TYPES_WITH_OPTIONS = new Set<Question["type"]>([
  "ranking", "choice", "trap", "hot_take", "trap_silent",
  "choice_emoji", "choice_hybrid", "hot_take_visual",
]);

export function buildQuestionOptionsMap(questions: Question[]): Record<number, string[]> {
  const map: Record<number, string[]> = {};
  questions.forEach((q, i) => {
    if (TYPES_WITH_OPTIONS.has(q.type) && "options" in q) {
      map[i] = (q as { options: string[] }).options;
    }
    if (q.type === "media_reaction" && q.options) {
      map[i] = q.options;
    }
  });
  return map;
}

// --- Full-screen question types (skip the standard header layout) ---
export const FULLSCREEN_TYPES = new Set<Question["type"]>([
  "dead_drop", "hot_take", "hot_take_visual", "media_reaction", "rafaga_burst",
]);
