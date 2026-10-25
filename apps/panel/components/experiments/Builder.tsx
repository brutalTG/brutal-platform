"use client";
// Armador de experimentos: Experimentos (armar y ordenar) + Caja de herramientas (las piezas).
// Mismas pantallas que el panel del sandbox, guardando en la base.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { hydrate, onSaveState, clearSaveError, type PanelDrop, type PanelQuestion, type SaveState } from "./panel-store";
import { DropManager } from "./DropManager";
import { DropEditor } from "./DropEditor";
import { QuestionLibrary } from "./QuestionLibrary";
import { QuestionBuilder } from "./QuestionBuilder";

const LIGHT: Record<string, string> = {
  "--p-bg": "#f5f5f5", "--p-bg-sidebar": "#ffffff", "--p-bg-card": "#ffffff", "--p-bg-hover": "#eeeeee",
  "--p-bg-active": "#e0e0e0", "--p-bg-input": "#ffffff", "--p-border": "#cccccc", "--p-border-subtle": "#dddddd",
  "--p-text": "#000000", "--p-text-secondary": "#222222", "--p-text-muted": "#444444", "--p-text-faint": "#666666",
  "--p-text-ghost": "#888888", "--p-accent": "#000000", "--p-accent-fg": "#ffffff", "--p-danger": "#cc0022",
  "--p-success": "#007733", "--p-warning": "#aa6600", "--p-badge-bg": "#e0e0e0", "--p-badge-text": "#000000",
  "--p-scrollbar-track": "#eeeeee", "--p-scrollbar-thumb": "#bbbbbb",
};

type View =
  | { screen: "drops" }
  | { screen: "drop_editor"; dropId: string }
  | { screen: "pieces" }
  | { screen: "piece"; editId?: string };

export function Builder({ initial, tab }: { initial: { questions: PanelQuestion[]; drops: PanelDrop[] }; tab: "experimentos" | "piezas" }) {
  // La copia en memoria se carga una sola vez, antes de pintar las pantallas.
  useMemo(() => hydrate(initial), [initial]);
  const [view, setView] = useState<View>(tab === "piezas" ? { screen: "pieces" } : { screen: "drops" });
  const [save, setSave] = useState<SaveState>({ pending: 0, error: null });
  useEffect(() => onSaveState(setSave), []);

  // Avisar antes de cerrar si queda algo sin guardar.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (save.pending > 0) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [save.pending]);

  let body: React.ReactNode;
  switch (view.screen) {
    case "drops":
      body = <DropManager onEditDrop={(id) => setView({ screen: "drop_editor", dropId: id })} />;
      break;
    case "drop_editor":
      body = <DropEditor dropId={view.dropId} onBack={() => setView({ screen: "drops" })} onRefresh={() => {}} />;
      break;
    case "pieces":
      body = (
        <QuestionLibrary
          onCreateNew={() => setView({ screen: "piece" })}
          onEdit={(id) => setView({ screen: "piece", editId: id })}
        />
      );
      break;
    case "piece":
      body = (
        <QuestionBuilder
          editId={view.editId}
          onSaved={() => setView({ screen: "pieces" })}
          onCancel={() => setView({ screen: "pieces" })}
        />
      );
      break;
  }

  return (
    <div className="experiments-builder rounded-lg p-4 md:p-6" style={{ ...LIGHT, backgroundColor: "var(--p-bg)", color: "var(--p-text)" } as React.CSSProperties}>
      <div className="mb-4 flex min-h-6 items-center justify-end gap-2 text-xs" aria-live="polite">
        {save.error ? (
          <span className="flex items-center gap-2 rounded px-2 py-1" style={{ background: "#fde8ec", color: "var(--p-danger)" }}>
            <AlertTriangle size={14} /> {save.error}
            <button className="underline" onClick={() => location.reload()}><RefreshCw size={12} className="inline" /> Recargar</button>
            <button className="underline" onClick={clearSaveError}>Cerrar</button>
          </span>
        ) : save.pending > 0 ? (
          <span className="flex items-center gap-1.5" style={{ color: "var(--p-text-faint)" }}><Loader2 size={14} className="animate-spin" /> Guardando…</span>
        ) : (
          <span className="flex items-center gap-1.5" style={{ color: "var(--p-text-ghost)" }}><Check size={14} /> Todo guardado</span>
        )}
      </div>
      {body}
    </div>
  );
}
