import Link from 'next/link';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// Filtros como formulario GET: la URL guarda el estado y se puede compartir.
export function FilterBar({ children, action }: { children: React.ReactNode; action: string }) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
      {children}
      <button type="submit" className="h-8 rounded border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-sunken">Aplicar</button>
    </form>
  );
}

export function SearchInput({ name, defaultValue, placeholder }: { name: string; defaultValue?: string; placeholder: string }) {
  return (
    <label className="relative flex-1 min-w-[200px]">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-3" aria-hidden />
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-8 w-full rounded border border-border-strong bg-surface pl-8 pr-3 text-base outline-none focus:border-focus focus:ring-2 focus:ring-focus/20"
      />
    </label>
  );
}

export function SelectFilter({ name, label, defaultValue, options }: { name: string; label: string; defaultValue?: string; options: { value: string; label: string }[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-fg-3">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ''}
        className="h-8 rounded border border-border-strong bg-surface px-2 text-base outline-none focus:border-focus focus:ring-2 focus:ring-focus/20"
      >
        <option value="">Todos</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Pagination({ page, pageSize, total, base, params }: { page: number; pageSize: number; total: number; base: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, pagina: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${q}`;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'inline-flex h-7 items-center rounded border border-border-strong bg-surface px-2.5 text-sm hover:bg-sunken';
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-fg-3">
      <span className="tabular">{from}–{to} de {total}</span>
      <div className="flex gap-2">
        {page > 1 ? <Link className={btn} href={href(page - 1)}>Anterior</Link> : <span className={cn(btn, 'pointer-events-none opacity-50')} aria-disabled>Anterior</span>}
        {page < pages ? <Link className={btn} href={href(page + 1)}>Siguiente</Link> : <span className={cn(btn, 'pointer-events-none opacity-50')} aria-disabled>Siguiente</span>}
      </div>
    </div>
  );
}
