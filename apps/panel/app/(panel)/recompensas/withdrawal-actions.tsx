'use client';

import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/ui/confirm';
import { resolveWithdrawal } from '@/lib/actions';

export function WithdrawalActions({ id, amount }: { id: string; amount: string }) {
  return (
    <div className="flex justify-end gap-2">
      <ConfirmAction
        trigger={<Button size="sm" variant="danger-outline">Rechazar</Button>}
        title="Rechazar el retiro"
        description={`El nodo conserva los ${amount} en su saldo y puede volver a pedirlo.`}
        confirmLabel="Rechazar"
        tone="danger"
        action={() => resolveWithdrawal(id, 'rejected')}
      />
      <ConfirmAction
        trigger={<Button size="sm" variant="primary">Aprobar</Button>}
        title={`Aprobar retiro de ${amount}`}
        description="Queda listo para pagar. El pago se hace por fuera del panel y se marca después."
        confirmLabel="Aprobar"
        action={() => resolveWithdrawal(id, 'approved')}
      />
    </div>
  );
}
