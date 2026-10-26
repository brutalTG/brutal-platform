'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { login, type LoginState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-fg">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          aria-invalid={!!state.error}
          aria-describedby={state.error ? 'login-error' : undefined}
          className="h-9 rounded border border-border-strong bg-surface px-3 text-base outline-none focus:border-focus focus:ring-2 focus:ring-focus/20 aria-[invalid=true]:border-danger"
        />
        {state.error && <p id="login-error" role="alert" className="text-sm text-danger">{state.error}</p>}
      </div>
      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full">
        {pending ? 'Ingresando…' : 'Ingresar'}
      </Button>
    </form>
  );
}
