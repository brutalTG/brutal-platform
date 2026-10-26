import { EmptyState } from '@/components/ui/primitives';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return <EmptyState title="No existe" description="Lo que buscás no está en este entorno." action={<ButtonLink href="/">Volver a Hoy</ButtonLink>} />;
}
