import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nf = new Intl.NumberFormat('es-AR');
const pf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const df = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
const dtf = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
const rtf = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });

export const fmt = {
  n: (v: number | string | null | undefined) => (v === null || v === undefined ? '—' : nf.format(Number(v))),
  pct: (v: number | string | null | undefined) => (v === null || v === undefined ? '—' : `${pf.format(Number(v))}%`),
  usd: (v: number | string | null | undefined) => (v === null || v === undefined ? '—' : usd.format(Number(v))),
  date: (v: string | null | undefined) => (v ? df.format(new Date(v)) : '—'),
  datetime: (v: string | null | undefined) => (v ? dtf.format(new Date(v)) : '—'),
  duration: (seconds: number | string | null | undefined) => {
    if (seconds === null || seconds === undefined) return '—';
    const s = Math.round(Number(seconds));
    const m = Math.floor(s / 60);
    return m > 0 ? `${m} min ${s % 60} s` : `${s} s`;
  },
  ago: (v: string | null | undefined, now = Date.now()) => {
    if (!v) return '—';
    const diff = (new Date(v).getTime() - now) / 1000;
    const abs = Math.abs(diff);
    if (abs < 60) return rtf.format(Math.round(diff), 'second');
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
    return df.format(new Date(v));
  },
  phone: (v: string | null | undefined) => (v ? `${v.slice(0, -4).replace(/\d/g, '•')}${v.slice(-4)}` : '—'),
};
