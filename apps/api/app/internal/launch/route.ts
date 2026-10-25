import { handle, json, requireInternal, HttpError } from '@/lib/http';
import { launchDrop } from '@/lib/messaging';
import type { Audience } from '@/lib/launch-rules';

export const runtime = 'nodejs';
export const maxDuration = 300;

// El panel manda un experimento a un grupo de nodos. Con dry_run solo cuenta a quiénes llegaría.
export const POST = handle(async (req) => {
  await requireInternal(req);
  const b = await req.json().catch(() => ({})) as { drop?: string; audience?: Audience; dry_run?: boolean };
  if (!b.drop || !/^[a-z0-9-]{3,80}$/.test(b.drop)) throw new HttpError(400, 'bad_drop');
  const a = b.audience ?? { type: 'all' };
  if (!['all', 'filter', 'phones'].includes((a as any).type)) throw new HttpError(400, 'bad_audience');
  return json(req, await launchDrop(b.drop, a, b.dry_run !== false));
});
