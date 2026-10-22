import { LogOut } from 'lucide-react';
import { Sidebar, MobileNav } from '@/components/shell/sidebar';
import { from } from '@/lib/db';
import { panelEnv, envLabel } from '@/lib/env';
import { logout } from '@/app/login/actions';

async function attentionCounts() {
  try {
    const [{ data: k }, { count }] = await Promise.all([
      from('core', 'ops_kpis').select('*').single(),
      from('core', 'audit_log').select('id', { count: 'exact', head: true })
        .eq('actor_type', 'claude').gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()),
    ]);
    const attention = k ? Number(k.pending_withdrawals) + Number(k.rejected_templates) + (Number(k.pressure_interrupted_7d) > 0 ? 1 : 0) + (Number(k.pending_nodes) > 0 ? 1 : 0) : 0;
    return { attention, bitacora: count ?? 0 };
  } catch {
    return {};
  }
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const env = panelEnv();
  const counts = await attentionCounts();
  return (
    <div className="flex min-h-full flex-col">
      {env === 'test' && (
        <div className="sticky top-0 z-30 flex h-7 items-center justify-center gap-2 bg-envtest text-xs font-semibold uppercase tracking-wider text-black">
          Entorno de test · los datos son de prueba
        </div>
      )}
      <div className="flex flex-1">
        <aside className="sticky top-7 hidden h-[calc(100vh-28px)] w-60 shrink-0 flex-col border-r border-border bg-bg md:flex">
          <div className="flex h-14 items-center gap-2 border-b border-border px-5">
            <span className="text-md font-bold tracking-tight">BRUTAL</span>
            <span className="rounded-sm border border-border px-1.5 text-xs text-fg-3">{envLabel[env]}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Sidebar counts={counts} />
          </div>
          <form action={logout} className="border-t border-border p-3">
            <button className="flex h-8 w-full items-center gap-2 rounded px-2 text-base text-fg-2 hover:bg-sunken hover:text-fg [&_svg]:size-4">
              <LogOut aria-hidden /> Salir
            </button>
          </form>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="sticky top-7 z-20 border-b border-border bg-bg/95 backdrop-blur md:hidden">
            <div className="flex h-11 items-center justify-between px-4"><span className="font-bold tracking-tight">BRUTAL</span><span className="text-xs text-fg-3">{envLabel[env]}</span></div>
            <MobileNav />
          </div>
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
