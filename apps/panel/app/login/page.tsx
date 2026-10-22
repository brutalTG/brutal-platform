import { LoginForm } from './form';
import { panelEnv } from '@/lib/env';

export const metadata = { title: 'Ingresar' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const env = panelEnv();
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold tracking-tight">BRUTAL</div>
          <p className="mt-1 text-sm text-fg-3">Panel de operación{env === 'test' ? ' · entorno de test' : ''}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <LoginForm next={next ?? '/'} />
        </div>
      </div>
    </div>
  );
}
