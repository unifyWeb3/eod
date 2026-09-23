import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EOD — Verdict infrastructure for agentic work',
  description:
    'Define what "done" means before work begins. EOD uses deterministic checks and GenLayer consensus to produce a finalized verdict that payment systems can act on.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
