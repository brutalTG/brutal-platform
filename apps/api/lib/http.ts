import 'server-only';
import { env } from './env';
import { verifyToken, safeEqual } from './crypto';

// Respuestas JSON con CORS solo para la webapp del juego.
export function cors(origin: string | null) {
  const allowed = new Set([env.pressureOrigin, ...(env.brutalEnv === 'test' ? ['http://localhost:3002'] : [])]);
  const h: Record<string, string> = { Vary: 'Origin' };
  if (origin && allowed.has(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
    h['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
    h['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
    h['Access-Control-Max-Age'] = '600';
  }
  return h;
}

export function json(req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req.headers.get('origin')), ...extra },
  });
}

export function preflight(req: Request) {
  return new Response(null, { status: 204, headers: cors(req.headers.get('origin')) });
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) { super(message ?? code); }
}

// Envuelve un handler: los errores conocidos salen con su código; los demás, como 500 sin detalles.
export function handle(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json(req, { error: e.code, message: e.message }, e.status);
      console.error(e);
      return json(req, { error: 'server_error' }, 500);
    }
  };
}

export async function sessionFrom(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const v = await verifyToken(env.sessionSecret, token);
  if (!v) throw new HttpError(401, 'invalid_session', 'La partida venció o el link no es válido.');
  return v.sessionId;
}

export async function requireInternal(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (env.internalSecret.length < 32 || !(await safeEqual(token, env.internalSecret))) throw new HttpError(401, 'unauthorized');
}
