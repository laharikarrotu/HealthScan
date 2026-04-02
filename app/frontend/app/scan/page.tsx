import dynamic from 'next/dynamic';
import RouteLoading from '../components/RouteLoading';

// Lazy load ScanPage for code splitting
const ScanPage = dynamic(() => import('../components/ScanPage'), {
  loading: () => <RouteLoading label="Loading scan…" />,
});

export default function ScanPageRoute() {
  return <ScanPage />;
}

