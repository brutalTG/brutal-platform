import type { MetadataRoute } from 'next';

// Si lo agregan a la pantalla de inicio, abre a pantalla completa, sin las barras del navegador.
// Sin start_url: el ícono abre el link personal desde el que lo agregaron.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PRESSURE · Brutal',
    short_name: 'PRESSURE',
    display: 'fullscreen',
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'portrait',
  };
}
