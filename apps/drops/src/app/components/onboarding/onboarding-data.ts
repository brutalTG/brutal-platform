// ============================================================
// ONBOARDING DATA — Permanent, minimal node foundation
// ============================================================

import type { OnboardingStep } from "./onboarding-types";

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ── INTRO ──────────────────────────────────────────────────
  {
    id: "intro",
    type: "intro",
    phase: "intro",
    title: "Entrá a Brutal",
    subtitle:
      "Cinco datos para empezar. Después te conocemos jugando.",
  },

  // ── FASE A: DATOS DUROS ───────────────────────────────────
  {
    id: "nickname",
    type: "text_input",
    phase: "A",
    copy: "Como te decimos?\nElegi un nombre. Puede ser el tuyo, puede ser inventado.",
    placeholder: "Tu apodo",
    maxLength: 20,
  },
  {
    id: "age",
    type: "age_selector",
    phase: "A",
    copy: "Cuantos anos tenes?",
    min: 15,
    max: 35,
    rejectMessage:
      "BRUTAL es para personas de 15 a 35 años.\nPero no te preocupes, vas a poder seguirnos desde afuera.",
  },
  {
    id: "gender",
    type: "single_choice",
    phase: "A",
    copy: "Como te identificas?",
    options: ["Hombre", "Mujer", "No binario", "Prefiero no decir"],
  },
  {
    id: "location",
    type: "nested_choice",
    phase: "A",
    copy: "Donde vivis?",
    options: [
      {
        label: "CABA",
        subOptions: [
          "Palermo", "Recoleta", "Belgrano", "Caballito", "Nunez",
          "Villa Urquiza", "Almagro", "San Telmo", "La Boca", "Flores",
          "Villa Devoto", "Otro barrio",
        ],
      },
      { label: "GBA Norte" },
      { label: "GBA Sur" },
      { label: "GBA Oeste" },
      {
        label: "Interior",
        subOptions: [
          "Buenos Aires (interior)", "Cordoba", "Santa Fe", "Mendoza",
          "Tucuman", "Salta", "Entre Rios", "Misiones", "Chaco",
          "Neuquen", "Rio Negro", "Otra provincia",
        ],
      },
    ],
  },
  {
    id: "platforms",
    type: "multi_select",
    phase: "A",
    copy: "¿Qué usas todos los días?",
    options: [
      "TikTok",
      "Instagram",
      "YouTube",
      "X",
      "Twitch",
      "Discord",
      "Spotify",
    ],
    minSelect: 1,
    maxSelect: 3,
  },

  // ── CIERRE ────────────────────────────────────────────────
  {
    id: "closing",
    type: "closing",
    phase: "closing",
  },
];
