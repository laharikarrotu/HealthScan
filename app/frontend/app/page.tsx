'use client';

import dynamic from 'next/dynamic';
import RouteLoading from './components/RouteLoading';

// Lazy load ChatAgent for better initial page load
const ChatAgent = dynamic(() => import('./components/ChatAgent'), {
  loading: () => <RouteLoading label="Loading assistant…" />,
  ssr: false // ChatAgent uses client-side features
});

export default function Home() {
  return <ChatAgent />;
}
