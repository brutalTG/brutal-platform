import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/status';

// ---------- Badge de estado ----------
const toneClass: Record<Tone, string> = {
  neutral: 'bg-sunken text-fg-2 border-border',
  success: 'bg-success-bg text-success border-success/20',
  warning: 'bg-warning-bg text-warning border-warning/20',
  danger: 'bg-danger-bg text-danger border-danger/20',
  info: 'bg-info-bg text-info border-info/20',
  accent: 'bg-primary text-primary-fg border-primary',
};
const dotClass: Record<Tone, string> = {
  neutral: 'bg-fg-3', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', info: 'bg-info', accent: 'bg-primary-fg',
};

export function Badge({ tone = 'neutral', children, dot = true, className }: { tone?: Tone; children: React.ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 items-center gap-1.5 rounded-sm border px-1.5 text-xs font-medium', toneClass[tone], className)}>
      {dot && <span className={cn('size-1.5 rounded-full', dotClass[tone])} aria-hidden />}
      {children}
    </span>
  );
}

// ---------- Tarjeta ----------
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('rounded-md border border-border bg-surface shadow-card', className)}>{children}</section>;
}

export function CardHeader({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <header className={cn('flex items-start justify-between gap-4 border-b border-border px-4 py-3', className)}>
      <div className="min-w-0">
        <h2 className="text-md font-semibold text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-3">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('p-4', className)}>{children}</div>;
}

// ---------- Encabezado de página ----------
export function PageHeader({
  crumbs = [],
  title,
  description,
  actions,
  meta,
}: {
  crumbs?: { href: string; label: string }[];
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {crumbs.length > 0 && (
        <nav aria-label="Ruta" className="mb-2 flex items-center gap-1 text-sm text-fg-3">
          {crumbs.map((c) => (
            <React.Fragment key={c.href}>
              <Link href={c.href} className="hover:text-fg">{c.label}</Link>
              <ChevronRight className="size-3.5" aria-hidden />
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-base text-fg-2">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

// ---------- Indicador ----------
export function Stat({ label, value, hint, tone, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: Tone; href?: string }) {
  const body = (
    <div className={cn('rounded-md border border-border bg-surface p-4 shadow-card', href && 'transition-colors hover:border-border-strong')}>
      <div className="text-sm text-fg-3">{label}</div>
      <div className={cn('tabular mt-1 text-2xl font-semibold tracking-tight', tone === 'danger' && 'text-danger', tone === 'warning' && 'text-warning')}>{value}</div>
      {hint && <div className="mt-1 text-sm text-fg-3">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block rounded-md">{body}</Link> : body;
}

// ---------- Tabla ----------
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-left text-base">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-border bg-sunken/60 text-xs font-medium uppercase tracking-wide text-fg-3">{children}</thead>;
}
export function TH({ children, align = 'left', className }: { children?: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return <th scope="col" className={cn('h-9 whitespace-nowrap px-4 font-medium', align === 'right' && 'text-right', className)}>{children}</th>;
}
export function TR({ children, href }: { children: React.ReactNode; href?: string }) {
  return <tr className={cn('border-b border-border last:border-0', href && 'cursor-pointer hover:bg-sunken/60')}>{children}</tr>;
}
export function TD({ children, align = 'left', className, muted }: { children?: React.ReactNode; align?: 'left' | 'right'; className?: string; muted?: boolean }) {
  return <td className={cn('h-11 px-4 align-middle', align === 'right' && 'tabular text-right', muted && 'text-fg-3', className)}>{children}</td>;
}
export function RowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-medium text-fg hover:underline underline-offset-2">{children}</Link>;
}

// ---------- Estado vacío y de error ----------
export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-sunken text-fg-3 [&_svg]:size-5">{icon}</div>}
      <p className="text-md font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNotice({ title = 'No se pudo cargar esta sección', message }: { title?: string; message: string }) {
  return (
    <div role="alert" className="rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-danger/90">{message}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-sunken', className)} aria-hidden />;
}

// ---------- Lista de definición ----------
export function DL({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-sm text-fg-3">{i.label}</dt>
          <dd className="mt-0.5 truncate text-base text-fg">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- Barra de progreso ----------
export function Meter({ value, max = 100, tone = 'neutral' }: { value: number; max?: number; tone?: Tone }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const bar = tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : tone === 'success' ? 'bg-success' : 'bg-fg-2';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------- Pestañas (navegación por URL) ----------
export function Tabs({ items, active }: { items: { href: string; label: string; key: string; count?: number }[]; active: string }) {
  return (
    <nav aria-label="Secciones" className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
      {items.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              '-mb-px flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-base transition-colors',
              on ? 'border-fg font-medium text-fg' : 'border-transparent text-fg-3 hover:text-fg',
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="tabular rounded-sm bg-sunken px-1 text-xs text-fg-2">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
