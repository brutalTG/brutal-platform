# Reglas para agentes (Claude, Codex y cualquier otro)

Este repo lo desarrollan agentes sin un ingeniero revisando cada línea. Estas reglas existen para que eso sea seguro.

## Producción

- **Nunca** se toca producción sin la confirmación explícita de Nacho en ese momento: ni la base `brutal-production`, ni las variables de Vercel de producción, ni la rama `main`, ni los agentes de ElevenLabs publicados.
- Todo se prueba primero en test (rama `test`, base `brutal-sandbox`, dominios `test-*.brutal.lat`).

## Ramas y cambios

- `main` = producción. `test` = test. Ninguna de las dos recibe commits directos.
- Cada cambio va en una rama propia → PR contra `test` → CI verde → se prueba en test → PR de `test` a `main`.
- Un PR hace una sola cosa y explica en castellano qué cambia para el usuario.

## Base de datos

- La base solo cambia con archivos en `packages/db/migrations`. Nada se aplica a mano en el editor SQL de Supabase.
- Las migraciones van hacia adelante: nunca se edita una migración ya aplicada; se escribe una nueva.
- Cada app tiene su propio esquema (`drops.*`, `pressure.*`). Lo compartido vive en `core.*`, `economy.*` y `messaging.*`.
- RLS activado en todas las tablas. El navegador nunca habla directo con la base: todo pasa por un servidor.

## Secretos

- Ningún secreto en el código ni en los documentos. Van en las variables de entorno de Vercel, separadas por entorno.
- Ningún ID de proveedor (agentes de ElevenLabs, plantillas de WhatsApp) escrito en el código: van en la base o en variables.

## Menores

- El universo va de 15 a 35 años. Un menor nunca recibe efectivo ni puede cargar una billetera; solo Golden Tickets.
- Toda función que toque recompensas o pagos necesita una prueba específica para menores.

## Pruebas

- Toda lógica de servidor nueva lleva pruebas. El CI corre pruebas y chequeo de tipos en cada PR.
