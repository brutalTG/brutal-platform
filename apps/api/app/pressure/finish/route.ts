import { handle, json, preflight, sessionFrom } from '@/lib/http';
import { finish } from '@/lib/pressure';

export const runtime = 'nodejs';
export const OPTIONS = preflight;

export const POST = handle(async (req) => json(req, await finish(await sessionFrom(req))));
