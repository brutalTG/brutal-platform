# api

API central (`api.brutal.lat`, test: `test-api.brutal.lat`). Única pieza que escribe en `core`, `economy` y `messaging`.

| Ruta | Qué hace |
| --- | --- |
| `POST /whatsapp/webhook` | Mensajes de WATI. Responde solo a invitados (nodos cargados). |
| `POST /pressure/start` | Abre una partida desde el link personal. Devuelve el token y el guion. |
| `POST /pressure/answer` | Una respuesta hablada: compromiso verdad/mentira, audio, rasgos de la voz. |
| `POST /pressure/tts` | Voz de la máquina. Solo frases del guion de esa partida. Con caché. |
| `POST /pressure/finish` | Acusación, resultado, tickets, aviso por WhatsApp. |
| `POST /pressure/abandon` | Partida cortada. |
| `POST /internal/simulate` | Solo test: el panel simula un mensaje entrante. |
| `GET /health` | Qué variables faltan, sin mostrar valores. |

Variables: ver `docs/entornos.md`.
