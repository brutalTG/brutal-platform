'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, FlaskConical, Users, Layers, Coins, MessageSquare, Settings2, ScrollText, Blocks, DoorOpen, ChartColumn, FileText, Lightbulb, Flame, Menu, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = { href: string; label: string; icon: React.ReactNode; badge?: number };

export function Sidebar({ counts, large = false }: { counts: { attention?: number; bitacora?: number }; large?: boolean }) {
  const path = usePathname();
  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Armar',
      items: [
        { href: '/', label: 'Hoy', icon: <LayoutDashboard />, badge: counts.attention },
        { href: '/estudios', label: 'Estudios', icon: <Lightbulb /> },
        { href: '/experimentos', label: 'Experimentos', icon: <FlaskConical /> },
        { href: '/amigos', label: 'Amigos de mierda', icon: <Flame /> },
        { href: '/herramientas', label: 'Caja de herramientas', icon: <Blocks /> },
        { href: '/onboarding', label: 'Onboarding', icon: <DoorOpen /> },
      ],
    },
    {
      title: 'Leer',
      items: [
        { href: '/resultados', label: 'Resultados', icon: <ChartColumn /> },
        { href: '/informes', label: 'Informes', icon: <FileText /> },
        { href: '/drops', label: 'Campo en vivo', icon: <Layers /> },
        { href: '/nodos', label: 'Nodos', icon: <Users /> },
      ],
    },
    {
      title: 'Ajustes',
      items: [
        { href: '/recompensas', label: 'Recompensas', icon: <Coins /> },
        { href: '/mensajes', label: 'Mensajes', icon: <MessageSquare /> },
        { href: '/sistema', label: 'Sistema', icon: <Settings2 /> },
        { href: '/bitacora', label: 'Bitácora', icon: <ScrollText />, badge: counts.bitacora },
      ],
    },
  ];

  const isActive = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

  return (
    <nav aria-label="Secciones del panel" className="flex flex-col gap-5 px-3 py-4">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="px-2 pb-1.5 text-xs font-medium uppercase tracking-wider text-fg-3">{g.title}</div>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((i) => {
              const active = isActive(i.href);
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      large ? 'flex h-12 items-center gap-3 rounded px-3 text-[17px] transition-colors [&_svg]:size-5' : 'flex h-8 items-center gap-2.5 rounded px-2 text-base transition-colors [&_svg]:size-4',
                      active ? 'bg-surface font-medium text-fg shadow-card ring-1 ring-border' : 'text-fg-2 hover:bg-sunken hover:text-fg',
                    )}
                  >
                    <span className={active ? 'text-fg' : 'text-fg-3'}>{i.icon}</span>
                    <span className="flex-1">{i.label}</span>
                    {!!i.badge && (
                      <span className="tabular min-w-5 rounded-sm bg-warning-bg px-1 text-center text-xs font-medium text-warning">{i.badge}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// En el celular: barra de abajo con lo más usado y "Más" con todas las secciones, como una app.
const TABS: [string, string, React.ReactNode][] = [
  ['/', 'Hoy', <LayoutDashboard key="i" />],
  ['/experimentos', 'Experimentos', <FlaskConical key="i" />],
  ['/herramientas', 'Caja', <Blocks key="i" />],
  ['/resultados', 'Resultados', <ChartColumn key="i" />],
];

export function MobileNav({ counts = {}, logout }: { counts?: { attention?: number; bitacora?: number }; logout?: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  const isActive = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  const inTabs = TABS.some(([href]) => isActive(href));
  const item = 'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] [&_svg]:size-5';
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 flex flex-col bg-bg md:hidden" role="dialog" aria-label="Todas las secciones">
          <div className="flex h-12 items-center justify-between border-b border-border px-4">
            <span className="font-bold tracking-tight">Secciones</span>
            <button onClick={() => setOpen(false)} className="flex size-9 items-center justify-center rounded text-fg-2 [&_svg]:size-5" aria-label="Cerrar"><X /></button>
          </div>
          <div className="flex-1 overflow-y-auto pb-24">
            <Sidebar counts={counts} large />
            {logout && <div className="px-5 pb-6">{logout}</div>}
          </div>
        </div>
      )}
      <nav aria-label="Secciones del panel" className="fixed inset-x-0 bottom-0 z-50 flex h-[64px] border-t border-border bg-bg/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(([href, label, icon]) => (
          <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined} className={cn(item, isActive(href) && !open ? 'font-semibold text-fg' : 'text-fg-3')}>
            {icon}
            <span>{label}</span>
          </Link>
        ))}
        <button onClick={() => setOpen((x) => !x)} aria-expanded={open} className={cn(item, open || !inTabs ? 'font-semibold text-fg' : 'text-fg-3')}>
          <span className="relative"><Menu />{!!counts.attention && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-warning" />}</span>
          <span>Más</span>
        </button>
      </nav>
    </>
  );
}

/** Nombre de la sección actual (barra de arriba en el celular). */
export function SectionTitle() {
  const path = usePathname();
  const names: [string, string][] = [
    ['/estudios', 'Estudios'], ['/experimentos', 'Experimentos'], ['/amigos', 'Amigos de mierda'], ['/herramientas', 'Caja de herramientas'],
    ['/onboarding', 'Onboarding'], ['/resultados', 'Resultados'], ['/informes', 'Informes'], ['/drops', 'Campo en vivo'], ['/nodos', 'Nodos'],
    ['/recompensas', 'Recompensas'], ['/mensajes', 'Mensajes'], ['/sistema', 'Sistema'], ['/bitacora', 'Bitácora'], ['/pressure', 'Pressure'],
  ];
  const hit = names.find(([h]) => path === h || path.startsWith(h + '/'));
  return <span className="truncate text-sm text-fg-2">{hit ? hit[1] : 'Hoy'}</span>;
}
