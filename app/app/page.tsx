import type { Metadata } from 'next';
import AppClient from './AppClient';
import { HistoryView } from '../../components/HistoryView';

export const metadata: Metadata = {
  title: 'App — EOD acceptance workflow',
  description:
    'Create acceptance jobs, track GenLayer finality, and inspect verdicts.',
};

export default function AppPage() {
  return <AppClient history={<HistoryView />} />;
}
