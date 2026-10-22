'use client';

import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ui/primitives';

export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <ErrorNotice message={error.message || 'Ocurrió un error inesperado.'} />
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
