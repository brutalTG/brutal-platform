import { handle, json, preflight, HttpError } from '@/lib/http';
import {
  accessContext, accessFrom, activeDrop, apply, applyInit, claimDrop, completeSession, economyPolicy, exchangeCode, gate,
  dropHilo, dropTts, joinGroup, joinOpened, leaderboard, recordResponse, recordVoice, setWallet, startSession, userProfile,
} from '@/lib/drops';
import { cors } from '@/lib/http';

// Todo el API del reproductor de Drops bajo /drops/*. Mismas rutas que el servidor del sandbox.
export const runtime = 'nodejs';
export const maxDuration = 60;
export const OPTIONS = preflight;

type Ctx = { params: Promise<{ path: string[] }> };
const body = async (req: Request) => (await req.json().catch(() => ({}))) as Record<string, any>;

async function route(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path.join('/');
  const m = req.method;
  const url = new URL(req.url);

  if (m === 'POST' && path === 'access') {
    const b = await body(req);
    return json(req, await exchangeCode(String(b.code ?? '')));
  }
  if (m === 'GET' && path === 'access/context') {
    const purpose = url.searchParams.get('purpose');
    if (purpose !== 'onboarding' && purpose !== 'drop') throw new HttpError(400, 'bad_purpose', 'Invalid access purpose');
    return json(req, await accessContext(await accessFrom(req, purpose)));
  }
  if (m === 'POST' && path === 'join') return json(req, await joinGroup(await body(req)), 201);
  if (m === 'POST' && path === 'join/open') return json(req, await joinOpened(await body(req), req.headers.get('user-agent')));
  if (m === 'POST' && path === 'apply/init') return json(req, await applyInit(await accessFrom(req, 'onboarding')));
  if (m === 'POST' && path === 'apply') return json(req, await apply(await accessFrom(req, 'onboarding'), await body(req)), 201);
  if (m === 'GET' && path === 'leaderboard') {
    await accessFrom(req);
    return json(req, await leaderboard(Number(url.searchParams.get('limit')) || 20));
  }

  const a = await accessFrom(req, 'drop');
  if (m === 'GET' && path === 'gate') return json(req, await gate(a));
  if (m === 'GET' && path === 'active-drop') return json(req, await activeDrop(a));
  if (m === 'POST' && path === 'sessions/start') return json(req, await startSession(a, await body(req)));
  if (m === 'POST' && path === 'responses') return json(req, await recordResponse(a, await body(req)));
  if (m === 'POST' && path === 'voice') return json(req, await recordVoice(a, await req.formData()));
  if (m === 'POST' && path === 'hilo') return json(req, await dropHilo(a, await body(req)));
  if (m === 'POST' && path === 'tts') {
    const audio = await dropTts(a, await body(req));
    return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=3600', ...cors(req.headers.get('origin')) } });
  }
  if (m === 'POST' && path === 'sessions/complete') return json(req, await completeSession(a, await body(req)));
  if (m === 'POST' && path === 'claim-rewards') return json(req, await claimDrop(a, await body(req)));
  if (m === 'GET' && path === 'user/profile') return json(req, await userProfile(a));
  if (m === 'PUT' && path === 'user/wallet') return json(req, await setWallet(a, await body(req)));
  if (m === 'GET' && path === 'economy-policy') return json(req, await economyPolicy(a));
  throw new HttpError(404, 'not_found');
}

const h = (req: Request, ctx: Ctx) => handle((r) => route(r, ctx))(req);
export const GET = h;
export const POST = h;
export const PUT = h;
