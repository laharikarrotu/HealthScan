import dynamic from 'next/dynamic';
import RouteLoading from '../components/RouteLoading';

// Lazy load DietPortal for code splitting
const DietPortal = dynamic(() => import('../components/DietPortal'), {
  loading: () => <RouteLoading label="Loading diet…" />,
});

export default function DietPage() {
  return <DietPortal />;
}
