'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, SESSION_HOURS, safeEqual, signSession } from '@/lib/session';
import { audit } from '@/lib/db';

export type LoginState = { error?: string };

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/');
  const expected = process.env.PANEL_PASSWORD;
  const secret = process.env.PANEL_SESSION_SECRET;
  if (!expected || !secret) return { error: 'El panel no está configurado en este entorno.' };
  // Una pausa fija hace inútil probar contraseñas en serie.
  await new Promise((r) => setTimeout(r, 400));
  if (!(await safeEqual(password, expected))) return { error: 'La contraseña no es correcta.' };

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(secret, 'panel'), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_HOURS * 3600,
  });
  try { await audit('ingresó al panel', 'session', 'panel'); } catch { /* el ingreso no depende de la bitácora */ }
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect('/login');
}
