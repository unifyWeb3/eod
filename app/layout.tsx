import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acceptance Adapter — GenLayer Inspector',
  description:
    'Routine post-delivery acceptance receipts backed by GenLayer consensus.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
          <h1>Acceptance Adapter — inspector</h1>
          <p>
            Every deliverable ends in a finalized GenLayer receipt
            (ACCEPT / REJECT / UNDETERMINED) that gates fund release.
          </p>
          {children}
        </main>
      </body>
    </html>
  );
}
