import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// El panel lee y escribe solo desde el servidor, con la clave de servicio del entorno.
// El navegador nunca recibe esta clave.

let client: SupabaseClient | null = null;

export function db() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Falta configurar la conexión a la base (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY).');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export type Schema = 'core' | 'signal' | 'profile' | 'economy' | 'messaging' | 'drops' | 'pressure' | 'amigos';

export function from(schema: Schema, table: string) {
  return db().schema(schema).from(table);
}

// Convierte el error de la base en un mensaje que sirve para actuar.
export function explain(error: { message?: string; code?: string } | null): string | null {
  if (!error) return null;
  if (error.code === 'PGRST106' || /schema must be one of/i.test(error.message ?? '')) {
    return 'La base no tiene habilitados los esquemas del panel en su API. Hay que agregarlos en Supabase → Data API → Exposed schemas.';
  }
  return error.message ?? 'Error desconocido de la base.';
}

export async function audit(action: string, entity_type: string, entity_id: string, details: Record<string, unknown> = {}, actor = 'panel') {
  await from('core', 'audit_log').insert({ actor_type: 'admin', actor_id: actor, action, entity_type, entity_id, details });
}
