// ============================================================
// SESSION UPLOADER — Per-card upload lifecycle to Hono server
// ============================================================
// Architecture (3-call lifecycle):
//   1. serverStartSession(dropId) → POST /sessions/start → session_id
//   2. uploadResponse(question, index, answer, dropId, currentMultiplier) → POST /responses (per-card, immediate)
//   3. completeSession({ archetype_result, bic_scores }) → POST /sessions/complete
//
// All endpoints require the signed standalone access delivered by WhatsApp.
// Fire-and-forget: errors are swallowed and never block the Drop UI.
// Offline queue: responses accumulate in memory when offline, flushed on reconnect.
// ============================================================

import type { UserAnswer } from "./archetype-engine";
import type { Question } from "./drop-types";
import { userAuthHeaders } from "./access-context";
import { API_BASE } from "./api-base";
import { takeAway } from "./latency-tracker";

// ============================================================
// State
// ============================================================

let _sessionId: string | null = null;

/** La partida en curso (la necesitan las cartas que hablan con el servidor mientras se juegan, como mayor o menor). */
export const currentSessionId = () => _sessionId;

/** Espera a que la partida exista (se crea en segundo plano al arrancar). */
export async function waitForSession(timeoutMs = 8000): Promise<string | null> {
  const end = Date.now() + timeoutMs;
  while (!_sessionId && Date.now() < end) await new Promise((r) => setTimeout(r, 150));
  return _sessionId;
}
let _dropId: string | null = null;

/** Offline queue — responses that couldn't be sent yet */
const _offlineQueue: Array<{ question: Question; index: number; answer: UserAnswer; dropId: string; currentMultiplier: number }> = [];

/** Track the completeSession promise so the UI can await it */
let _completionPromise: Promise<boolean> | null = null;
let _responseChain: Promise<void> = Promise.resolve();

// ============================================================
// Helpers
// ============================================================

/** Build common headers */
const authHeaders = userAuthHeaders;

/**
 * Fetch with retry — 3 attempts, exponential backoff (1s, 2s, 4s).
 * Only retries 5xx errors. 4xx are considered permanent failure.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts = 3
): Promise<Response | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      // 4xx = permanent failure, don't retry
      if (res.status >= 400 && res.status < 500) {
        const body = await res.text().catch(() => "");
        console.error(`[BRUTAL] ${url} → ${res.status}: ${body}`);
        return null;
      }
      // 5xx = transient, retry
      console.warn(`[BRUTAL] ${url} → ${res.status}, attempt ${attempt}/${maxAttempts}`);
    } catch (err) {
      console.warn(`[BRUTAL] ${url} network error, attempt ${attempt}/${maxAttempts}:`, err);
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  console.error(`[BRUTAL] ${url} failed after ${maxAttempts} attempts`);
  return null;
}

/**
 * Map UserAnswer fields to the flat fields expected by POST /responses.
 * Server expects: choice_index, slider_value, ranking_result, rafaga_choices,
 * text_response, latency_ms, raw_response
 */
function answerToPayloadFields(answer: UserAnswer, index: number): Record<string, any> {
  const meta = { ...(answer.meta ?? {}), ...(takeAway(index) ?? {}) };
  const fields: Record<string, any> = {
    latency_ms: answer.latencyMs ?? null,
    ...(Object.keys(meta).length ? { meta } : {}),
  };

  switch (answer.type) {
    case "choice":
    case "hot_take":
    case "trap_silent":
      fields.choice_index = answer.selectedIndex;
      break;
    case "slider":
      fields.slider_value = answer.value;
      break;
    case "ranking":
      fields.ranking_result = answer.order;
      break;
    case "rafaga":
    case "rafaga_burst":
      fields.rafaga_choices = answer.answers;
      break;
    case "trap":
      fields.choice_index = answer.selectedIndex;
      break;
    case "confesionario":
      // Text is stripped for privacy in the answer pipeline;
      // if somehow present, send as text_response
      fields.text_response = (answer as any).text || null;
      break;
    case "dead_drop":
    case "timeout":
      // No additional data
      break;
    case "prediction_bet":
      fields.choice = answer.side;
      break;
    case "mayor_menor":
      // La mano la guarda el servidor; acá solo se avisa que terminó.
      break;
  }

  return fields;
}

// ============================================================
// Lifecycle: 1. Start Session
// ============================================================

/**
 * Start a server session for a Drop.
 * Returns the session_id on success, null on failure.
 * Non-blocking — call in background.
 */
export async function serverStartSession(dropId: string): Promise<string | null> {
  _dropId = dropId;
  _sessionId = null;

  try {
    const res = await fetchWithRetry(`${API_BASE}/sessions/start`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ drop_id: dropId, device: { userAgent: navigator.userAgent, width: window.innerWidth, height: window.innerHeight } }),
    });

    if (!res) return null;
    const data = await res.json();
    _sessionId = data.session_id || null;
    console.log(`[BRUTAL] Session started: ${_sessionId} (resumed: ${data.resumed})`);

    // Now flush any responses that queued while session was starting
    if (_sessionId && _offlineQueue.length > 0) {
      _flushQueue();
    }

    return _sessionId;
  } catch (err) {
    console.error("[BRUTAL] startSession error:", err);
    return null;
  }
}

// ============================================================
// Lifecycle: 2. Upload Response (per-card)
// ============================================================

/**
 * Upload a single card response to the server.
 * If offline or session not started, queues for later.
 * Fire-and-forget — never throws, never blocks UI.
 */
export async function uploadResponse(
  question: Question,
  index: number,
  answer: UserAnswer,
  dropId: string,
  currentMultiplier: number = 1
): Promise<void> {
  // Queue if offline
  if (!navigator.onLine) {
    _offlineQueue.push({ question, index, answer, dropId, currentMultiplier });
    console.log(`[BRUTAL] Offline — queued response for card ${index}`);
    return;
  }

  // Queue if session not started yet
  if (!_sessionId) {
    _offlineQueue.push({ question, index, answer, dropId, currentMultiplier });
    console.log(`[BRUTAL] No session_id yet — queued response for card ${index}`);
    return;
  }

  _responseChain = _responseChain.then(() => _sendResponse(question, index, answer, dropId, currentMultiplier));
  await _responseChain;
}

/** Internal: actually send a response to the server */
async function _sendResponse(
  question: Question,
  index: number,
  answer: UserAnswer,
  dropId: string,
  currentMultiplier: number = 1
): Promise<void> {
  if (!_sessionId) return;

  if (answer.type === "voice") {
    const form = new FormData();
    form.append("session_id", _sessionId);
    form.append("question_id", (question as any).questionId || "");
    form.append("position_in_drop", String(index));
    form.append("latency_ms", String(answer.latencyMs ?? ""));
    form.append("speech_ms", String(answer.speechMs ?? ""));
    form.append("multiplier_at_position", String(currentMultiplier));
    if (answer.committed) {
      form.append("committed", answer.committed);
      form.append("decision_ms", String(answer.decisionMs ?? ""));
    }
    const vmeta = { ...(answer.meta ?? {}), ...(takeAway(index) ?? {}) };
    if (Object.keys(vmeta).length) form.append("meta", JSON.stringify(vmeta));
    if (answer.text) form.append("text", answer.text);
    if (answer.audio) form.append("audio", answer.audio, `respuesta.${answer.mime.includes("mp4") ? "m4a" : "webm"}`);
    const headers = { ...authHeaders() } as Record<string, string>;
    delete headers["Content-Type"];
    try {
      await fetchWithRetry(`${API_BASE}/voice`, { method: "POST", headers, body: form });
    } catch (err) {
      console.error(`[BRUTAL] Voice ${index} upload error:`, err);
    }
    return;
  }

  const payload: Record<string, any> = {
    session_id: _sessionId,
    drop_id: dropId,
    question_id: (question as any).questionId || null,
    position_in_drop: index,
    question_type: question.type,
    source: "drop_card",
    multiplier_at_position: currentMultiplier, // Send current multiplier to the backend
    ...answerToPayloadFields(answer, index),
  };

  try {
    const res = await fetchWithRetry(`${API_BASE}/responses`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      keepalive: true, // Survives page unload
    });

    if (res) {
      const data = await res.json().catch(() => ({}));
      console.log(`[BRUTAL] Response ${index} uploaded (x${currentMultiplier}): reward=${data.reward_granted}, cash=${data.cash_credited}, tickets=${data.tickets_credited}`);
    }
  } catch (err) {
    console.error(`[BRUTAL] Response ${index} upload error:`, err);
  }
}

// ============================================================
// Lifecycle: 3. Complete Session
// ============================================================

/**
 * Mark the session as completed on the server.
 * Flushes offline queue first.
 */
/** Lo que dice la máquina al cerrar la partida (solo en Drops con cartas de la máquina). */
export interface DetectorVerdict {
  lies: number[];
  accused: number[];
  caught: number;
  verdict: "caught" | "escaped";
  text: string;
  lie_labels: string[];
  tickets: number;
  /** Cada carta de la máquina: qué se preguntó, qué dijo, si mintió y si lo acusó. */
  cards?: { position: number; text: string; label: string; said: string; lied: boolean; accused: boolean }[];
}

export type CompleteResult = { ok: boolean; detector: DetectorVerdict | null };

export async function completeSession(params: {
  archetype_result?: { id: string; title: string };
  bic_scores?: any;
  multiplier?: number;
}): Promise<CompleteResult> {
  const doComplete = async (): Promise<CompleteResult> => {
    // Flush any queued responses first
    await _flushQueue();
    await _responseChain;

    if (!_sessionId) {
      console.warn("[BRUTAL] completeSession called without session_id");
      return { ok: false, detector: null };
    }

    try {
      const res = await fetchWithRetry(`${API_BASE}/sessions/complete`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          session_id: _sessionId,
          archetype_result: params.archetype_result || null,
          bic_scores: params.bic_scores || null,
          multiplier: params.multiplier || 1,
        }),
      });

      if (!res) return { ok: false, detector: null };
      const data = await res.json().catch(() => ({}));
      console.log("[BRUTAL] Session completed:", data);
      return { ok: Boolean(data?.ok ?? res.ok), detector: data?.detector ?? null };
    } catch (err) {
      console.error("[BRUTAL] completeSession error:", err);
      return { ok: false, detector: null };
    }
  };

  // Una sola llamada: waitForUpload espera la misma promesa.
  const result = doComplete();
  _completionPromise = result.then((r) => r.ok);
  return result;
}

// ============================================================
// Offline Queue
// ============================================================

/** Flush all queued responses */
async function _flushQueue(): Promise<void> {
  if (_offlineQueue.length === 0) return;
  if (!_sessionId) return;

  console.log(`[BRUTAL] Flushing ${_offlineQueue.length} queued responses`);
  const queue = [..._offlineQueue];
  _offlineQueue.length = 0;

  for (const item of queue) {
    _responseChain = _responseChain.then(() => _sendResponse(item.question, item.index, item.answer, item.dropId, item.currentMultiplier || 1));
  }
  await _responseChain;
}

// Auto-flush when coming back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.log("[BRUTAL] Back online — flushing queue");
    _flushQueue();
  });
}

// ============================================================
// Legacy stubs — kept for backward compatibility
// ============================================================

/** @deprecated No-op. Sessions are now uploaded per-card. */
export async function uploadSession(_session: any): Promise<boolean> {
  console.log("[BRUTAL] uploadSession() is deprecated — responses are sent per-card now");
  return true;
}

/** Wait for any pending completion to finish */
export async function waitForUpload(): Promise<void> {
  await _flushQueue();
  await _responseChain;
  if (_completionPromise) {
    await _completionPromise;
    _completionPromise = null;
  }
}

/**
 * Claim rewards for a completed drop.
 * Idempotent: server checks if already claimed.
 */
export async function claimRewards(params: {
  dropId: string;
  coins: number;
  tickets: number;
  finalTickets: number;
  multiplier?: number;
}): Promise<{ ok: boolean; alreadyClaimed?: boolean; credited?: { coins: number; tickets: number; dropsCompleted: number } }> {
  console.log(`[BRUTAL] Claiming rewards: dropId=${params.dropId}, cash=${params.coins}, tickets=${params.finalTickets}`);

  const res = await fetch(`${API_BASE}/claim-rewards`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[BRUTAL] Claim failed (${res.status}): ${errBody}`);
    throw new Error(`Claim failed: ${res.status} ${errBody}`);
  }

  const result = await res.json();
  console.log("[BRUTAL] Claim result:", result);
  return result;
}

/** Reset state between drops */
export function resetUploader(): void {
  _sessionId = null;
  _dropId = null;
  _offlineQueue.length = 0;
  _completionPromise = null;
  _responseChain = Promise.resolve();
}
