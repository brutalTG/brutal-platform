'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FlaskConical, Users, Layers, AudioLines, Coins, MessageSquare, Settings2, ScrollText, Blocks, DoorOpen, ChartColumn,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = { href: string; label: string; icon: React.ReactNode; badge?: number };

export function Sidebar({ counts }: { counts: { attention?: number; bitacora?: number } }) {
  const path = usePathname();
  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'Armar',
      items: [
        { href: '/', label: 'Hoy', icon: <LayoutDashboard />, badge: counts.attention },
        { href: '/onboarding', label: 'Onboarding', icon: <DoorOpen /> },
        { href: '/experimentos', label: 'Experimentos', icon: <FlaskConical /> },
        { href: '/herramientas', label: 'Caja de herramientas', icon: <Blocks /> },
      ],
    },
    {
      title: 'Resultados',
      items: [
        { href: '/nodos', label: 'Nodos', icon: <Users /> },
        { href: '/drops', label: 'Partidas de Drops', icon: <Layers /> },
        { href: '/pressure', label: 'Detector (voz)', icon: <AudioLines /> },
        { href: '/estudios', label: 'Estudios', icon: <ChartColumn /> },
      ],
    },
    {
      title: 'Plataforma',
      items: [
        { href: '/recompensas', label: 'Recompensas', icon: <Coins /> },
        { href: '/mensajes', label: 'Mensajes', icon: <MessageSquare /> },
        { href: '/sistema', label: 'Sistema', icon: <Settings2 /> },
      ],
    },
    {
      title: 'Inteligencia',
      items: [{ href: '/bitacora', label: 'Bitácora', icon: <ScrollText />, badge: counts.bitacora }],
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
                      'flex h-8 items-center gap-2.5 rounded px-2 text-base transition-colors [&_svg]:size-4',
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

// En pantallas chicas el menú pasa a una fila desplazable arriba.
export function MobileNav() {
  const path = usePathname();
  const items = [
    ['/', 'Hoy'], ['/onboarding', 'Onboarding'], ['/experimentos', 'Experimentos'], ['/herramientas', 'Herramientas'],
    ['/nodos', 'Nodos'], ['/drops', 'Partidas'], ['/pressure', 'Detector'], ['/estudios', 'Estudios'],
    ['/recompensas', 'Recompensas'], ['/mensajes', 'Mensajes'], ['/sistema', 'Sistema'], ['/bitacora', 'Bitácora'],
  ];
  const isActive = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));
  return (
    <nav aria-label="Secciones del panel" className="flex gap-1 overflow-x-auto px-3 py-2">
      {items.map(([href, label]) => (
        <Link key={href} href={href} aria-current={isActive(href) ? 'page' : undefined}
          className={cn('whitespace-nowrap rounded px-2.5 py-1 text-sm', isActive(href) ? 'bg-surface font-medium text-fg ring-1 ring-border' : 'text-fg-2')}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
