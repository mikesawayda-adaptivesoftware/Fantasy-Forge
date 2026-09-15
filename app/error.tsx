'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/ui/ErrorState';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState message="Something went wrong on this page." onRetry={reset} />;
}
