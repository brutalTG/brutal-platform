import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

export function db() {
  if (client) return client;
  if (!env.supabaseUrl || !env.supabaseKey) throw new Error('Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  client = createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export type Schema = 'core' | 'signal' | 'profile' | 'economy' | 'messaging' | 'drops' | 'pressure';
export const from = (schema: Schema, table: string) => db().schema(schema).from(table);

// Devuelve los datos o tira el error con contexto. Evita olvidarse de chequear `error`.
export async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

export async function audit(action: string, entity_type: string, entity_id: string, details: Record<string, unknown> = {}) {
  await from('core', 'audit_log').insert({ actor_type: 'system', actor_id: 'api', action, entity_type, entity_id, details });
}
