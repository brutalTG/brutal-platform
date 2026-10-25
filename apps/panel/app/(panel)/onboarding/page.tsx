import { loadOnboarding } from '@/lib/experiments-actions';
import { ErrorNotice, PageHeader } from '@/components/ui/primitives';
import { OnboardingForm } from './form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Onboarding' };

export default async function OnboardingPage() {
  const r = await loadOnboarding();
  return (
    <>
      <PageHeader
        title="Onboarding"
        description="Lo que ve alguien nuevo la primera vez que entra por su link de WhatsApp. Los datos que se piden son fijos (son el perfil permanente del nodo); acá cambiás cómo se preguntan y las opciones."
      />
      {r.ok ? <OnboardingForm texts={r.texts} /> : <ErrorNotice message={r.error} />}
    </>
  );
}
