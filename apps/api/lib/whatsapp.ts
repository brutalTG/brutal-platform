// WhatsApp por WATI. En test sin claves funciona en modo simulado: los mensajes quedan en la base
// y el panel los muestra, pero no sale nada.

export type Inbound = { providerMessageId: string; waId: string; phone: string; displayName: string | null; text: string; at: string | null };
export type Command = 'play' | 'ranking' | 'opt_out' | 'help';

export function identity(value: unknown) {
  const waId = String(value ?? '').replace(/\D/g, '');
  if (!/^[1-9][0-9]{7,14}$/.test(waId)) return null;
  return { waId, phone: `+${waId}` };
}

function canonical(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function command(text: string): Command {
  const t = canonical(text);
  if (['BAJA', 'STOP', 'SALIR', 'NO ME ESCRIBAN'].includes(t)) return 'opt_out';
  if (['RANKING', 'TABLA', 'TICKETS', 'PUNTOS'].includes(t)) return 'ranking';
  if (['AYUDA', 'MENU', 'HELP'].includes(t)) return 'help';
  // Cualquier otra cosa ("hola", "JUGAR", "PRESSURE") recibe el link al juego.
  return 'play';
}

function iso(value: unknown): string | null {
  if (typeof value === 'string' && value && !/^\d+(\.\d+)?$/.test(value)) {
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n > 1e10 ? n : n * 1000).toISOString();
}

// WATI manda un evento por mensaje. Solo tomamos los entrantes (owner !== true).
export function parseWati(payload: unknown): Inbound[] {
  const events = Array.isArray(payload) ? payload : [payload];
  const out: Inbound[] = [];
  for (const e of events as Record<string, any>[]) {
    const type = String(e?.eventType ?? e?.type ?? '').toLowerCase();
    if (!['message', 'messagereceived', 'newcontactmessagereceived', 'text'].includes(type)) continue;
    if (e?.owner === true) continue;
    const who = identity(e?.waId ?? e?.whatsappNumber ?? e?.from);
    const id = e?.whatsappMessageId ?? e?.id ?? e?.localMessageId;
    if (!who || !id) continue;
    const text = typeof e?.text === 'string' ? e.text
      : e?.buttonReply?.title ?? e?.listReply?.title ?? e?.buttonReply?.id ?? '';
    out.push({
      providerMessageId: String(id), waId: who.waId, phone: who.phone,
      displayName: e?.senderName ? String(e.senderName).slice(0, 120) : null,
      text: String(text).slice(0, 2000), at: iso(e?.timestamp ?? e?.created),
    });
  }
  return out;
}

export function render(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export type SendResult = { ok: true; providerMessageId: string } | { ok: false; errorCode: string; errorMessage: string };

export async function sendText(
  cfg: { mode: 'mock' | 'wati' | 'disabled'; endpoint: string; token: string; channel: string },
  to: string,
  text: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  if (cfg.mode === 'disabled') return { ok: false, errorCode: 'disabled', errorMessage: 'WhatsApp apagado' };
  if (cfg.mode === 'mock') return { ok: true, providerMessageId: `mock-${crypto.randomUUID()}` };
  try {
    const url = new URL(`${cfg.endpoint}/api/v1/sendSessionMessage/${encodeURIComponent(to.replace(/\D/g, ''))}`);
    url.searchParams.set('messageText', text);
    if (cfg.channel) url.searchParams.set('channelPhoneNumber', cfg.channel);
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token.replace(/^Bearer\s+/i, '')}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data?.result === false || data?.ok === false) {
      return { ok: false, errorCode: String(data?.errorCode ?? res.status), errorMessage: String(data?.info ?? data?.message ?? 'WATI no aceptó el mensaje').slice(0, 500) };
    }
    const id = data?.message?.whatsappMessageId ?? data?.message?.id ?? data?.localMessageId ?? data?.id ?? `wati-${crypto.randomUUID()}`;
    return { ok: true, providerMessageId: String(id) };
  } catch (e) {
    return { ok: false, errorCode: 'network_error', errorMessage: e instanceof Error ? e.message.slice(0, 300) : 'error de red' };
  }
}
