import Link from 'next/link';
import { buttonVariants } from './ui/button';
import { cn } from '../lib/utils';

export function SiteHeader() {
  return (
    <header className="border-b border-[#E8E6E1] bg-[#FAFAF8]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
          aria-label="EOD home"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#1A1D21] font-mono text-[11px] font-bold text-white"
          >
            EOD
          </span>
          EOD
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 text-sm md:flex">
          <Link className="text-[#5B6068] hover:text-[#1A1D21]" href="#how">
            How it works
          </Link>
          <Link className="text-[#5B6068] hover:text-[#1A1D21]" href="/app">
            Live jobs
          </Link>
          <Link className="text-[#5B6068] hover:text-[#1A1D21]" href="#architecture">
            Architecture
          </Link>
          <Link
            className="text-[#5B6068] hover:text-[#1A1D21]"
            href="https://github.com/unifyWeb3/eod"
          >
            GitHub
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="hidden text-sm text-[#5B6068] hover:text-[#1A1D21] sm:inline"
          >
            View live jobs
          </Link>
          <Link
            href="/app"
            className={buttonVariants({ variant: 'primary', className: 'min-h-[40px] px-4' })}
          >
            Launch app
          </Link>
        </div>
      </div>
    </header>
  );
}

export function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn('scroll-mt-20 py-16 md:py-24', className)}>
      <div className="mx-auto max-w-[1120px] px-6">
        {eyebrow ? (
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#1E40AF]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="max-w-[640px] text-2xl font-semibold md:text-[32px] md:leading-[1.2]">
          {title}
        </h2>
        {lede ? (
          <p className="mt-4 max-w-[640px] text-base leading-relaxed text-[#5B6068]">
            {lede}
          </p>
        ) : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
