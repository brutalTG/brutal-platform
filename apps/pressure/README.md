# pressure

Webapp de los juegos de voz (`pressure.brutal.lat`, test: `test-pressure.brutal.lat`).

Primer juego: **La máquina** (detector de mentiras). Se entra solo con el link personal que manda el bot por WhatsApp (`/j/<código>`).

- La voz de la máquina sale de ElevenLabs a través del API (`/pressure/tts`); si falla, la dice el navegador.
- El micrófono se mide acá (arranque, pausas, tono) y el audio se manda al API para transcribir. No se guarda.
- No tiene claves: todo pasa por `NEXT_PUBLIC_API_URL`.
