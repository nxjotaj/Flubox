'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="route-error">
      <AlertTriangle />
      <h1>Não foi possível carregar seu painel.</h1>
      <p>Seus dados continuam seguros. Tente novamente em alguns instantes.</p>
      <Button onClick={reset}>
        <RotateCcw /> Tentar novamente
      </Button>
    </main>
  );
}
