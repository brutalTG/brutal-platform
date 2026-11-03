// Registro de piezas publicadas en /briefs. Las que viven en otro proyecto (como el 025) se linkean con `href`.
import type { ComponentType } from 'react';
import ElMiedo, { meta as elMiedo } from './el-miedo-es-de-los-duenos';

export type BriefMeta = {
  slug: string; kind: string; title: string; dek: string; date: string; minutes: number; topics: string;
  /** Si está, la pieza vive afuera y la tarjeta manda ahí. */
  href?: string;
};

export const briefs: { meta: BriefMeta; Component?: ComponentType }[] = [
  { meta: elMiedo, Component: ElMiedo },
  {
    meta: {
      slug: 'arriba-o-al-lado', kind: 'Black Brief 025', title: 'Arriba o al lado.',
      dek: 'Para un argentino de veinte años, el Estado y la empresa privada dejaron de ser dos cosas distintas. Lo que sí las separa hoy es otra cosa, y no la está midiendo nadie.',
      date: 'Septiembre 2026', minutes: 9, topics: 'Instituciones · Estado · Mercado',
      href: 'https://brutal-black-brief-025.vercel.app/',
    },
  },
];

export const findBrief = (slug: string) => briefs.find((b) => b.meta.slug === slug && b.Component);
