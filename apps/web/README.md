# web

Sitio público en `brutal.lat`. Hoy `brutal.lat` lo sirve el repo viejo (`brutal-signal-2026`); este es el sitio nuevo y se prueba en `test-web.brutal.lat`.

- `/briefs`: la sección de Black Briefs y notas. Cada pieza es un componente en `content/briefs/<slug>.tsx` y se registra en `content/briefs/index.ts`.
- El 025 sigue en su propio proyecto de Vercel y acá se linkea.
- Sin claves: no lee ninguna base. `BRUTAL_ENV=production` quita el `noindex`.
