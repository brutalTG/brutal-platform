'use client';

import * as React from 'react';
import { CheckCircle2, X } from 'lucide-react';

type Toast = { id: number; message: string };
const Ctx = React.createContext<{ show: (m: string) => void }>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);
  const show = React.useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, message }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-pop">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            <span>{t.message}</span>
            <button className="ml-2 text-fg-3 hover:text-fg" aria-label="Cerrar aviso" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => React.useContext(Ctx);
