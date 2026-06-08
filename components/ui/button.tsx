import * as React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-brand)] text-white hover:bg-[#5b21b6] active:bg-[#4c1d95]',
  secondary:
    'bg-[var(--color-brand-soft)] text-[var(--color-brand)] hover:bg-[#ddd6fe]',
  ghost:
    'bg-transparent text-[var(--color-ink)] hover:bg-black/5',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type,
  ...props
}: ButtonProps) {
  const classes = [base, variants[variant], sizes[size], className ?? '']
    .filter(Boolean)
    .join(' ');
  return <button type={type ?? 'button'} className={classes} {...props} />;
}
