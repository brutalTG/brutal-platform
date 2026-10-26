'use client';

import { Ban, CheckCircle2, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm';
import { setNodeStatus } from '@/lib/actions';

// Acciones del nodo según su estado: solo se ofrecen las que tienen sentido ahora.
export function NodeActions({ id, status, name }: { id: string; status: string; name: string }) {
  return (
    <>
      {status !== 'active' && status !== 'archived' && (
        <ConfirmAction
          trigger={<Button variant="primary" icon={<CheckCircle2 />}>Activar</Button>}
          title={`Activar a ${name}`}
          description="Va a poder entrar a las webapps y recibir invitaciones."
          confirmLabel="Activar"
          action={() => setNodeStatus(id, 'active')}
        />
      )}
      {status !== 'blocked' && status !== 'archived' && (
        <ConfirmAction
          trigger={<Button variant="danger-outline" icon={<Ban />}>Bloquear</Button>}
          title={`Bloquear a ${name}`}
          description="No va a poder entrar a ninguna webapp ni recibir mensajes. Se puede deshacer."
          confirmLabel="Bloquear"
          tone="danger"
          action={() => setNodeStatus(id, 'blocked')}
        />
      )}
      {status !== 'archived' && (
        <ConfirmAction
          trigger={<Button variant="ghost" icon={<Archive />}>Archivar</Button>}
          title={`Archivar a ${name}`}
          description="Sale de todos los listados y segmentos. Sus observaciones quedan para el análisis."
          confirmLabel="Archivar"
          tone="danger"
          action={() => setNodeStatus(id, 'archived')}
        />
      )}
    </>
  );
}
