import * as React from 'react';
import Link from 'next/link';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Botón estándar de panel: una acción primaria por vista, secundarias en contorno,
// destructivas en rojo y siempre detrás de una confirmación.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded font-medium transition-colors select-none ' +
    'disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-wait [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg hover:bg-primary/90 active:bg-primary/80',
        secondary: 'border border-border-strong bg-surface text-fg hover:bg-sunken active:bg-border',
        ghost: 'text-fg-2 hover:bg-sunken hover:text-fg',
        danger: 'bg-danger text-white hover:bg-danger/90 active:bg-danger/80',
        'danger-outline': 'border border-danger/40 bg-surface text-danger hover:bg-danger-bg',
      },
      size: {
        sm: 'h-7 px-2.5 text-sm',
        md: 'h-8 px-3 text-sm',
        lg: 'h-9 px-4 text-base',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { loading?: boolean; icon?: React.ReactNode };

export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant, size, loading, icon, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant,
  size,
  className,
  icon,
  children,
}: { href: string; className?: string; icon?: React.ReactNode; children: React.ReactNode } & VariantProps<typeof buttonVariants>) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant, size }), className)}>
      {icon}
      {children}
    </Link>
  );
}
