import type { HTMLAttributes, ReactNode } from 'react';

type PageShellProps = {
  children: ReactNode;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

/**
 * Full-height column wrapper so each route matches the home layout flex chain.
 * Pair with an inner `.hs-page` — the global hero backdrop is on `.hs-page::before`.
 */
export default function PageShell({ children, className = '', ...rest }: PageShellProps) {
  return (
    <div
      className={`flex h-full min-h-0 w-full flex-col text-slate-900${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </div>
  );
}
