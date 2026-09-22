import type { Metadata } from 'next';
import AppClient from './AppClient';

export const metadata: Metadata = {
  title: 'App — EOD acceptance workflow',
  description:
    'Prepare acceptance criteria and inspect finalized Bradbury jobs and receipts.',
};

export default function AppPage() {
  return <AppClient />;
}
