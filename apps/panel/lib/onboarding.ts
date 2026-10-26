// Onboarding de Drops: los pasos son fijos (son los datos permanentes del nodo); se editan textos y opciones.
// Valores de fábrica: copia de apps/drops/src/app/components/onboarding/onboarding-data.ts.

export type LocationOption = { label: string; subOptions?: string[] };
export type OnboardingTexts = {
  intro: { title: string; subtitle: string };
  nickname: { copy: string; placeholder: string };
  age: { copy: string; min: number; max: number; rejectMessage: string };
  gender: { copy: string; options: string[] };
  location: { copy: string; options: LocationOption[] };
  platforms: { copy: string; options: string[]; minSelect: number; maxSelect: number };
};

export const AGE_FLOOR = 15, AGE_CEILING = 35;

export const ONBOARDING_DEFAULTS: OnboardingTexts = {
  intro: { title: 'Entrá a Brutal', subtitle: 'Cinco datos para empezar. Después te conocemos jugando.' },
  nickname: { copy: 'Como te decimos?\nElegi un nombre. Puede ser el tuyo, puede ser inventado.', placeholder: 'Tu apodo' },
  age: {
    copy: 'Cuantos anos tenes?', min: 15, max: 35,
    rejectMessage: 'BRUTAL es para personas de 15 a 35 años.\nPero no te preocupes, vas a poder seguirnos desde afuera.',
  },
  gender: { copy: 'Como te identificas?', options: ['Hombre', 'Mujer', 'No binario', 'Prefiero no decir'] },
  location: {
    copy: 'Donde vivis?',
    options: [
      { label: 'CABA', subOptions: ['Palermo', 'Recoleta', 'Belgrano', 'Caballito', 'Nunez', 'Villa Urquiza', 'Almagro', 'San Telmo', 'La Boca', 'Flores', 'Villa Devoto', 'Otro barrio'] },
      { label: 'GBA Norte' }, { label: 'GBA Sur' }, { label: 'GBA Oeste' },
      { label: 'Interior', subOptions: ['Buenos Aires (interior)', 'Cordoba', 'Santa Fe', 'Mendoza', 'Tucuman', 'Salta', 'Entre Rios', 'Misiones', 'Chaco', 'Neuquen', 'Rio Negro', 'Otra provincia'] },
    ],
  },
  platforms: { copy: '¿Qué usas todos los días?', options: ['TikTok', 'Instagram', 'YouTube', 'X', 'Twitch', 'Discord', 'Spotify'], minSelect: 1, maxSelect: 3 },
};

const lines = (s: string, max = 40) => [...new Set(s.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => x.slice(0, max)))];

/** "CABA: Palermo, Recoleta" → { label, subOptions }. Una línea por opción. */
export function parseLocations(s: string): LocationOption[] {
  return lines(s, 400).map((l) => {
    const [label, rest] = l.split(/:(.*)/s);
    const subs = (rest ?? '').split(',').map((x) => x.trim().slice(0, 60)).filter(Boolean);
    return subs.length ? { label: label.trim().slice(0, 60), subOptions: subs } : { label: label.trim().slice(0, 60) };
  });
}

export const formatLocations = (o: LocationOption[]) => o.map((x) => (x.subOptions?.length ? `${x.label}: ${x.subOptions.join(', ')}` : x.label)).join('\n');

/** Valida y arma lo que se guarda. Devuelve errores por campo. */
export function buildTexts(get: (k: string) => string): { texts?: OnboardingTexts; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const t = (k: string, max: number, required = true) => {
    const v = get(k).replace(/\r/g, '').trim();
    if (required && !v) errors[k] = 'No puede quedar vacío.';
    if (v.length > max) errors[k] = `Máximo ${max} caracteres.`;
    return v.slice(0, max);
  };
  const n = (k: string, lo: number, hi: number) => {
    const v = Number.parseInt(get(k), 10);
    if (!Number.isFinite(v) || v < lo || v > hi) errors[k] = `Entre ${lo} y ${hi}.`;
    return v;
  };
  const gender = lines(get('gender.options'));
  const platforms = lines(get('platforms.options'));
  const location = parseLocations(get('location.options'));
  if (gender.length < 2) errors['gender.options'] = 'Al menos dos opciones, una por línea.';
  if (platforms.length < 2) errors['platforms.options'] = 'Al menos dos opciones, una por línea.';
  if (location.length < 2) errors['location.options'] = 'Al menos dos lugares, uno por línea.';
  const min = n('age.min', AGE_FLOOR, AGE_CEILING), max = n('age.max', AGE_FLOOR, AGE_CEILING);
  if (!errors['age.min'] && !errors['age.max'] && min >= max) errors['age.max'] = 'Tiene que ser mayor que la edad mínima.';
  const minSelect = n('platforms.minSelect', 1, 10), maxSelect = n('platforms.maxSelect', 1, 10);
  if (!errors['platforms.maxSelect'] && maxSelect < minSelect) errors['platforms.maxSelect'] = 'No puede ser menor que el mínimo.';
  const texts: OnboardingTexts = {
    intro: { title: t('intro.title', 60), subtitle: t('intro.subtitle', 200) },
    nickname: { copy: t('nickname.copy', 200), placeholder: t('nickname.placeholder', 40) },
    age: { copy: t('age.copy', 200), min, max, rejectMessage: t('age.rejectMessage', 300) },
    gender: { copy: t('gender.copy', 200), options: gender },
    location: { copy: t('location.copy', 200), options: location },
    platforms: { copy: t('platforms.copy', 200), options: platforms, minSelect, maxSelect: Math.min(maxSelect, platforms.length) },
  };
  return Object.keys(errors).length ? { errors } : { texts, errors };
}

/** Lo guardado encima de los valores de fábrica (por si falta algún paso). */
export function withDefaults(saved: Partial<OnboardingTexts> | null | undefined): OnboardingTexts {
  const out = structuredClone(ONBOARDING_DEFAULTS) as any;
  for (const [k, v] of Object.entries(saved ?? {})) if (out[k] && v && typeof v === 'object') out[k] = { ...out[k], ...v };
  return out;
}
