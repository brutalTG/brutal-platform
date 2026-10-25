# BRUTAL Platform

Repo único de BRUTAL: todas las apps, la base de datos y las piezas compartidas viven acá.

## Qué hay adentro

| Carpeta | Qué es | Producción | Test |
| --- | --- | --- | --- |
| `apps/web` | Sitio público | `brutal.lat` | `test.brutal.lat` |
| `apps/api` | API central: identidad del nodo, links firmados, economía, WhatsApp | `api.brutal.lat` | `test-api.brutal.lat` |
| `apps/panel` | Panel central. Cada webapp suma su sección | `panel.brutal.lat` | `test-panel.brutal.lat` |
| `apps/drops` | Webapp de Drops (incluye el onboarding del nodo) | `drops.brutal.lat` | `test-drops.brutal.lat` |
| `apps/pressure` | Webapp de Pressure (juegos de voz con ElevenLabs) | `pressure.brutal.lat` | `test-pressure.brutal.lat` |
| `apps/amigos` | Sitio público de AMIGOS DE MIERDA (el juego se juega por WhatsApp) | `amigos.brutal.lat` | `test-amigos.brutal.lat` |
| `apps/wa-gateway` | Número de WhatsApp propio de AMIGOS DE MIERDA. Proceso permanente (no va en Vercel) | Railway / VM | Railway / VM |
| `packages/db` | Esquema y migraciones de Supabase. Única fuente de verdad de la base | — | — |
| `packages/identity` | Links firmados, sesión del nodo y firma entre apps | — | — |
| `packages/ui` | Sistema de diseño compartido | — | — |
| `packages/config` | Configuración compartida (TypeScript, lint) | — | — |

## Entornos

Hay dos entornos idénticos. Ver [docs/entornos.md](docs/entornos.md).

- **Producción** sale de la rama `main`.
- **Test** sale de la rama `test`.

Todo cambio entra primero a `test` por un PR, se prueba ahí, y recién después pasa a `main` con otro PR.

## Cómo se agrega una webapp nueva

1. Crear `apps/<nombre>`.
2. Darle su esquema propio en la base (`<nombre>.*`) con migraciones en `packages/db/migrations`.
3. Usar `packages/identity` para que el nodo entre con un link firmado.
4. Pedir nodos, puntos e invitaciones a la API. Ninguna app usa la clave maestra de la base.
5. Sumar su sección al panel.
6. Crear su proyecto en Vercel con sus dos dominios (`<nombre>.brutal.lat` y `test-<nombre>.brutal.lat`).

## Estado

Etapa 0: estructura creada. Las apps se portan desde `brutal-production` (rama `agent/panel-test-access`) y `brutal-pressure` (rama `live`). El plan completo está en el documento "BRUTAL · Estado real y pase a producción".
