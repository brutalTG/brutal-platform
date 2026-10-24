import { Fragment } from 'react';

// Texto editable desde el panel: *así* va en negrita; una línea en blanco separa párrafos.
export function Rich({ text, vars = {} }: { text: string; vars?: Record<string, string | number> }) {
  const filled = text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ''));
  return (
    <>
      {filled.split(/\n\s*\n/).map((para, i) => (
        <p key={i}>
          {para.split('\n').map((line, l) => (
            <Fragment key={l}>
              {l > 0 && <br />}
              {line.split(/(\*[^*]+\*)/g).map((part, j) =>
                part.startsWith('*') && part.endsWith('*') && part.length > 2 ? <b key={j}>{part.slice(1, -1)}</b> : <Fragment key={j}>{part}</Fragment>,
              )}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}
