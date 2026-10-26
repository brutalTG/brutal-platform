import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import type { RoundSummary } from './types.ts';

// La estética de las placas: fondo negro, tipografía blanca y pesada, un solo acento.
const ACCENT = '#C8FF00';
const GREY = '#8A8A8A';
const W = 1080;

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 700 | 800; style: 'normal' }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(process.cwd(), 'assets/fonts/Inter-ExtraBold.woff')),
    readFile(join(process.cwd(), 'assets/fonts/Inter-Bold.woff')),
  ]).then(([x, b]) => [
    { name: 'Inter', data: x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength) as ArrayBuffer, weight: 800 as const, style: 'normal' as const },
    { name: 'Inter', data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, weight: 700 as const, style: 'normal' as const },
  ]);
  return fonts;
}

async function png(node: React.ReactElement, height: number) {
  return new ImageResponse(node, { width: W, height, fonts: await loadFonts(), headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } });
}

const Footer = ({ dark = true }: { dark?: boolean }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `3px solid ${dark ? '#2A2A2A' : 'rgba(0,0,0,0.25)'}`, paddingTop: 26 }}>
    <div style={{ display: 'flex', fontSize: 30, fontWeight: 800 }}>AMIGOS DE MIERDA</div>
    <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, letterSpacing: 4, color: dark ? GREY : 'rgba(0,0,0,0.55)' }}>BRUTAL</div>
  </div>
);

const promptSize = (t: string) => (t.length < 70 ? 88 : t.length < 120 ? 74 : t.length < 170 ? 62 : 52);

export function questionImage(q: { prompt: string; detail: string | null; option_a: string; option_b: string }, by: string, teaser?: string | null) {
  return png(
    <div style={{ width: W, height: 1350, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#000', color: '#fff', padding: 88, fontFamily: 'Inter' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, letterSpacing: 2, color: GREY, textTransform: 'uppercase' }}>{by}</div>
        <div style={{ display: 'flex', fontSize: promptSize(q.prompt), lineHeight: 1.04, fontWeight: 800, letterSpacing: -2 }}>{q.prompt}</div>
        {q.detail ? <div style={{ display: 'flex', fontSize: 46, lineHeight: 1.15, fontWeight: 700, color: '#BDBDBD' }}>{q.detail}</div> : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
        <div style={{ display: 'flex', gap: 22 }}>
          {[['A', q.option_a], ['B', q.option_b]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 8, border: '4px solid #fff', padding: '26px 28px' }}>
              <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, color: GREY }}>{k}</div>
              <div style={{ display: 'flex', fontSize: 40, lineHeight: 1.1, fontWeight: 800 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', fontSize: 44, lineHeight: 1.1, fontWeight: 800, color: teaser ? ACCENT : GREY }}>{teaser ?? 'Contestá A o B. Después apostá por los demás.'}</div>
        <Footer />
      </div>
    </div>,
    1350,
  );
}

export function revealImage(input: { group: string; number: number; day: number; prompt: string; option_a: string; option_b: string; summary: RoundSummary }) {
  const ms = input.summary.members ?? [];
  const n = Math.max(ms.length, 1);
  const cell = n <= 5 ? 30 : n <= 7 ? 24 : 20;
  const matrix = input.summary.matrix ?? {};
  return png(
    <div style={{ width: W, height: 1350, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#000', color: '#fff', padding: '72px 64px 64px', fontFamily: 'Inter' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', fontSize: 24, fontWeight: 800, letterSpacing: 2, color: GREY, textTransform: 'uppercase' }}>{`${input.group} · grupo #${input.number} · día ${input.day}`}</div>
        <div style={{ display: 'flex', fontSize: input.prompt.length < 90 ? 46 : 38, lineHeight: 1.08, fontWeight: 800, letterSpacing: -1 }}>{input.prompt}</div>
        <div style={{ display: 'flex', gap: 28, fontSize: 28, fontWeight: 800 }}>
          <div style={{ display: 'flex', color: ACCENT }}>{`A · ${input.option_a}`}</div>
          <div style={{ display: 'flex', color: '#fff' }}>{`B · ${input.option_b}`}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', flex: 1, alignItems: 'flex-end', fontSize: 18, color: GREY, fontWeight: 800, textTransform: 'uppercase' }}>apuesta ↓</div>
          {ms.map((m) => (
            <div key={m.id} style={{ display: 'flex', flex: 1, flexDirection: 'column', alignItems: 'center', fontSize: cell - 4, fontWeight: 800, borderBottom: '3px solid #2A2A2A', paddingBottom: 10 }}>
              <div style={{ display: 'flex' }}>{m.name.slice(0, 10)}</div>
              <div style={{ display: 'flex', fontSize: cell + 6, color: m.choice === 'a' ? ACCENT : m.choice === 'b' ? '#fff' : '#555' }}>{m.choice ? m.choice.toUpperCase() : '—'}</div>
            </div>
          ))}
        </div>
        {ms.map((row) => (
          <div key={row.id} style={{ display: 'flex', gap: 8 }}>
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', fontSize: cell, fontWeight: 800 }}>{row.name.slice(0, 10)}</div>
            {ms.map((col) => {
              const v = row.id === col.id ? 'self' : matrix[row.id]?.[col.id];
              const bg = v === true ? ACCENT : v === 'self' || v === undefined ? '#111' : '#1F1F1F';
              const fg = v === true ? '#000' : v === 'self' || v === undefined ? '#333' : '#666';
              return (
                <div key={col.id} style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', height: cell * 2.4, background: bg, color: fg, fontSize: cell, fontWeight: 800 }}>
                  {v === true ? 'SÍ' : v === false ? 'NO' : '—'}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 36, lineHeight: 1.12, fontWeight: 800 }}>
          {(input.summary.lines ?? []).map((l, i) => <div key={i} style={{ display: 'flex', color: i === 0 ? ACCENT : '#fff' }}>{l}</div>)}
        </div>
        <Footer />
      </div>
    </div>,
    1350,
  );
}

export function tableImage(input: { group: string; season: number; rows: { name: string; points: number }[] }) {
  const rows = input.rows.slice(0, 12);
  const size = rows.length <= 6 ? 64 : rows.length <= 9 ? 50 : 40;
  return png(
    <div style={{ width: W, height: 1350, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#000', color: '#fff', padding: 88, fontFamily: 'Inter' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, letterSpacing: 2, color: GREY, textTransform: 'uppercase' }}>{`${input.group} · temporada ${input.season}`}</div>
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 800, letterSpacing: -3 }}>La tabla</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0', borderBottom: '3px solid #1F1F1F', fontSize: size, fontWeight: 800, color: i === 0 ? ACCENT : i === rows.length - 1 && rows.length > 2 ? GREY : '#fff' }}>
            <div style={{ display: 'flex' }}>{`${i + 1}. ${r.name}`}</div>
            <div style={{ display: 'flex' }}>{String(r.points)}</div>
          </div>
        ))}
      </div>
      <Footer />
    </div>,
    1350,
  );
}

export function labelImage(input: { group: string; season: number; name: string; label: string; stat: string }) {
  return png(
    <div style={{ width: W, height: 1080, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: ACCENT, color: '#000', padding: 88, fontFamily: 'Inter' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(0,0,0,0.6)' }}>{`Temporada ${input.season} · ${input.group} · veredicto`}</div>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>{input.name}</div>
      </div>
      <div style={{ display: 'flex', fontSize: input.label.length < 40 ? 110 : 86, lineHeight: 0.98, fontWeight: 800, letterSpacing: -4 }}>{`${input.label}.`}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: 'rgba(0,0,0,0.7)' }}>{input.stat}</div>
        <Footer dark={false} />
      </div>
    </div>,
    1080,
  );
}
