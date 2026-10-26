// Vista previa de Markdown simple (títulos, negrita, cursiva, listas, citas). Escapa todo lo demás.
import * as React from 'react';

function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={i++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={i++} className="rounded bg-sunken px-1 text-sm">{t.slice(1, -1)}</code>);
    else out.push(<em key={i++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, '').split('\n');
  const nodes: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flush = () => {
    if (para.length) { nodes.push(<p key={nodes.length} className="my-3 leading-relaxed">{inline(para.join(' '))}</p>); para = []; }
    if (list) {
      const L = list.ordered ? 'ol' : 'ul';
      nodes.push(<L key={nodes.length} className={`my-3 ml-5 flex flex-col gap-1 ${list.ordered ? 'list-decimal' : 'list-disc'}`}>{list.items.map((t, i) => <li key={i}>{inline(t)}</li>)}</L>);
      list = null;
    }
  };
  for (const l of lines) {
    const h = l.match(/^(#{1,3})\s+(.*)$/);
    const li = l.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (h) { flush(); const lvl = h[1].length; nodes.push(lvl === 1 ? <h1 key={nodes.length} className="mb-3 mt-2 text-2xl font-bold">{inline(h[2])}</h1> : lvl === 2 ? <h2 key={nodes.length} className="mb-2 mt-6 text-lg font-semibold">{inline(h[2])}</h2> : <h3 key={nodes.length} className="mb-1 mt-4 font-semibold">{inline(h[2])}</h3>); continue; }
    if (li) { if (para.length) flush(); const ordered = /\d/.test(li[1]); if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; } list.items.push(li[2]); continue; }
    if (/^>\s?/.test(l)) { flush(); nodes.push(<blockquote key={nodes.length} className="my-3 border-l-2 border-border-strong pl-3 text-fg-2">{inline(l.replace(/^>\s?/, ''))}</blockquote>); continue; }
    if (!l.trim()) { flush(); continue; }
    if (list) flush();
    para.push(l.trim());
  }
  flush();
  return <div className="max-w-none text-md">{nodes}</div>;
}
