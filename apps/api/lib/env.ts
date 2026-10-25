import 'server-only';

// Todas las variables del API en un solo lugar. Lo que falta se informa, no rompe en silencio.
export const env = {
  brutalEnv: process.env.BRUTAL_ENV === 'production' ? 'production' : 'test',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  // Firma de los tokens de partida y del canal interno con el panel.
  sessionSecret: process.env.API_SESSION_SECRET ?? '',
  internalSecret: process.env.INTERNAL_API_SECRET ?? '',
  // Dónde vive la webapp del juego, para armar links y permitir CORS.
  pressureOrigin: (process.env.PRESSURE_ORIGIN ?? 'https://test-pressure.brutal.lat').replace(/\/+$/, ''),
  // Dónde vive el reproductor de Drops (onboarding, Drops, perfil, ranking).
  dropsOrigin: (process.env.DROPS_ORIGIN ?? 'https://test-drops.brutal.lat').replace(/\/+$/, ''),
  elevenlabsKey: process.env.ELEVENLABS_API_KEY ?? '',
  whatsappMode: (process.env.WHATSAPP_MODE ?? 'mock') as 'mock' | 'wati' | 'disabled',
  watiEndpoint: (process.env.WATI_API_ENDPOINT ?? '').replace(/\/+$/, ''),
  watiToken: process.env.WATI_API_TOKEN ?? '',
  watiChannel: (process.env.WATI_CHANNEL_NUMBER ?? '').replace(/\D/g, ''),
  watiWebhookSecret: process.env.WATI_WEBHOOK_SECRET ?? '',
};

export function missing(): string[] {
  const out: string[] = [];
  if (!env.supabaseUrl) out.push('SUPABASE_URL');
  if (!env.supabaseKey) out.push('SUPABASE_SERVICE_ROLE_KEY');
  if (env.sessionSecret.length < 32) out.push('API_SESSION_SECRET');
  if (env.internalSecret.length < 32) out.push('INTERNAL_API_SECRET');
  if (!env.elevenlabsKey) out.push('ELEVENLABS_API_KEY');
  if (env.whatsappMode === 'wati') {
    if (!/^https:\/\//.test(env.watiEndpoint)) out.push('WATI_API_ENDPOINT');
    if (!env.watiToken) out.push('WATI_API_TOKEN');
    if (!/^[1-9][0-9]{7,14}$/.test(env.watiChannel)) out.push('WATI_CHANNEL_NUMBER');
    if (env.watiWebhookSecret.length < 32) out.push('WATI_WEBHOOK_SECRET');
  }
  return out;
}
