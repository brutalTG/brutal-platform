import { Game } from './Game';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Game code={code} />;
}
