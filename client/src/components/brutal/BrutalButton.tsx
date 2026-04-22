import type { ButtonHTMLAttributes, ElementType, ReactNode } from 'react';

type Variant = 'solid' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type BrutalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  as?: ElementType;
  children: ReactNode;
};

const VARIANT_CLASS: Record<Variant, string> = {
  solid:
    'bg-acid text-ink shadow-[var(--shadow-brutal)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
  outline: 'bg-transparent text-ink dark:text-bone hover:bg-ink hover:text-bone',
  danger:
    'bg-orange text-ink shadow-[var(--shadow-brutal)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-2',
  lg: 'px-6 py-3 text-lg',
};

export const BrutalButton = ({
  variant = 'solid',
  size = 'md',
  as: Tag = 'button',
  children,
  className = '',
  type,
  disabled,
  ...rest
}: BrutalButtonProps) => {
  const base =
    'inline-flex items-center justify-center gap-2 border-2 border-ink uppercase font-mono tracking-tight transition-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0';

  const isButton = Tag === 'button';
  return (
    <Tag
      {...(isButton ? { type: type ?? 'button', disabled } : {})}
      className={`${base} ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
      {...rest}
    >
      <span aria-hidden="true">[</span>
      <span>{children}</span>
      <span aria-hidden="true">]</span>
    </Tag>
  );
};

export default BrutalButton;
