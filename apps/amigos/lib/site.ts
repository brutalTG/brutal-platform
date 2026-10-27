// Datos del sitio. El número del juego y el API vienen de variables de entorno, nunca escritos acá.
export const site = {
  number: (process.env.AMIGOS_PUBLIC_NUMBER ?? '').replace(/\D/g, ''),
  api: (process.env.API_URL ?? 'https://test-api.brutal.lat').replace(/\/+$/, ''),
  production: process.env.BRUTAL_ENV === 'production',
};

export function playLink(text = 'Quiero jugar con mi grupo') {
  return site.number ? `https://wa.me/${site.number}?text=${encodeURIComponent(text)}` : null;
}

export type Card = { id: string; prompt: string; detail: string | null; option_a: string; option_b: string };

// Si el API no responde, la página igual muestra cartas.
export const FALLBACK: Card[] = [
  { id: 'f1', prompt: 'Existe un grupo de WhatsApp de tus amigos sin vos. Te llega el link. Podés leerlo una sola vez.', detail: 'Después no podés hacer como que no lo leíste.', option_a: 'Lo leo', option_b: 'No lo abro' },
  { id: 'f2', prompt: 'Tu mejor amigo le está arruinando la vida a alguien que vos también querés. Te pide que no digas nada.', detail: null, option_a: 'Me callo', option_b: 'Hablo' },
  { id: 'f3', prompt: 'Tu viejo te ofrece quedarte con la empresa familiar. Si decís que no, la vende y esa plata no te toca nunca.', detail: 'Si decís que sí, laburás con él todos los días hasta que se jubile. No se va a jubilar.', option_a: 'Me quedo con la empresa', option_b: 'Que la venda' },
  { id: 'f4', prompt: 'La beca en la mejor universidad del mundo. Condición: 10 años sin pisar Argentina.', detail: 'Ni casamientos, ni velorios. Ni el de tu viejo.', option_a: 'Me voy', option_b: 'Me quedo' },
  { id: 'f5', prompt: 'Tu pareja de 5 años: o nos casamos y tenemos un hijo este año, o cortamos. Tenés 24.', detail: null, option_a: 'Me caso', option_b: 'Corto' },
  { id: 'f6', prompt: 'Uno de este grupo va a ser millonario y el resto no. Podés elegir que no sea nadie.', detail: null, option_a: 'Que sea uno', option_b: 'Que no sea nadie' },
];

export async function cards(limit = 200): Promise<Card[]> {
  try {
    const r = await fetch(`${site.api}/amigos/public/questions`, { next: { revalidate: 600 }, signal: AbortSignal.timeout(4000) });
    const b = (await r.json()) as { questions?: Card[] };
    return b.questions?.length ? b.questions.slice(0, limit) : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
