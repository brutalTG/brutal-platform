import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { briefs, findBrief } from '@/content/briefs';
import { Subscribe } from '@/components/subscribe';

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return briefs.filter((b) => b.Component).map((b) => ({ slug: b.meta.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const b = findBrief(slug);
  if (!b) return {};
  return { title: b.meta.title.replace(/\.$/, ''), description: b.meta.dek, openGraph: { title: `${b.meta.title.replace(/\.$/, '')} · BRUTAL`, description: b.meta.dek, type: 'article' } };
}

export default async function BriefPage({ params }: Params) {
  const { slug } = await params;
  const b = findBrief(slug);
  if (!b?.Component) notFound();
  const C = b.Component;
  return <main><C /><Subscribe /></main>;
}
