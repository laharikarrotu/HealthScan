import dynamic from 'next/dynamic';
import RouteLoading from '../components/RouteLoading';

// Lazy load InteractionChecker for code splitting
const InteractionChecker = dynamic(() => import('../components/InteractionChecker'), {
  loading: () => <RouteLoading label="Loading interactions…" />,
});

export default function InteractionsPage() {
  return <InteractionChecker />;
}

