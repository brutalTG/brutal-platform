"use client";
// ============================================================
// DROP EDITOR — Assemble & configure a drop from questions
// Migrated to CSS variables var(--p-*) for light/dark theming
// ============================================================

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ArrowLeft,
  GripVertical,
  Trash2,
  Copy,
  Plus,
  Download,
  Play,
  Archive,
  Settings,
  ArrowUp,
  ArrowDown,
  FileText,
  Pencil,
  Eye,
  EyeOff,
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
  Circle,
} from "lucide-react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  type PanelDrop,
  type PanelQuestion,
  getDropById,
  getQuestions,
  updateDrop,
  activateDrop,
  exportDropJSON,
  getQuestionById,
  duplicateQuestion as dupeQ,
  syncDropNow,
  publishDropNow,
  previewDrop,
  getStudies,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_ICONS,
} from "./panel-store";
import { QuestionLibrary } from "./QuestionLibrary";
import { QuestionBuilder } from "./QuestionBuilder";
import { SplashEditor } from "./SplashEditor";
// Unused import removed — API calls handled by panel-sync
import { DropSegmentSelector } from "./DropSegmentSelector";

const DRAG_TYPE = "DROP_QUESTION";
const STATUS_LABEL = { active: "En juego", draft: "Borrador", archived: "Archivado" } as const;

interface DropEditorProps {
  dropId: string;
  onBack: () => void;
  onRefresh: () => void;
}

// --- Draggable Question Card ---

interface DraggableCardProps {
  question: PanelQuestion;
  index: number;
  totalCount: number;
  isCheckpoint: { multiplier: number; label: string } | undefined;
  isDisabled: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (idx: number) => void;
  onDuplicate: (idx: number) => void;
  onEdit: (id: string) => void;
  onToggleDisable: (idx: number) => void;
}

function DraggableQuestionCard({
  question: q,
  index: idx,
  totalCount,
  isCheckpoint,
  isDisabled,
  onMove,
  onRemove,
  onDuplicate,
  onEdit,
  onToggleDisable,
}: DraggableCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: DRAG_TYPE,
    item: { index: idx },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: DRAG_TYPE,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = idx;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      onMove(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  dragPreview(drop(ref));

  const text = "text" in q.data ? (q.data as any).text : "";
  const preview = text?.slice(0, 60) || q.label;

  return (
    <div ref={ref}>
      {isCheckpoint && (
        <div className="flex items-center gap-2 py-1 px-3">
          <div className="flex-1 h-px bg-yellow-500/30" />
          <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
            🔓 {isCheckpoint.label}
          </span>
          <div className="flex-1 h-px bg-yellow-500/30" />
        </div>
      )}
      <div
        className="flex items-center gap-2 p-2.5 rounded-lg transition-all group"
        style={{
          backgroundColor: isDragging
            ? "var(--p-bg-hover)"
            : isDisabled
            ? "var(--p-bg)"
            : isOver
            ? "var(--p-bg-input)"
            : "var(--p-bg-card)",
          border: `1px solid ${
            isDragging
              ? "var(--p-border)"
              : isOver
              ? "color-mix(in srgb, var(--p-success) 30%, transparent)"
              : "var(--p-border-subtle)"
          }`,
          opacity: isDragging ? 0.4 : isDisabled ? 0.4 : 1,
        }}
      >
        {/* Index */}
        <span className="text-[10px] font-mono w-6 text-right shrink-0" style={{ color: "var(--p-text-ghost)" }}>{idx + 1}</span>

        {/* Drag handle */}
        <div
          ref={(el) => { drag(el); }}
          className="cursor-grab active:cursor-grabbing transition-colors shrink-0 p-0.5"
          style={{ color: "var(--p-text-ghost)" }}
          title="Arrastrar para reordenar"
        >
          <GripVertical size={14} />
        </div>

        {/* Type icon */}
        <span className="text-base shrink-0">{QUESTION_TYPE_ICONS[q.data.type]}</span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono" style={{ color: "var(--p-text-ghost)" }}>{QUESTION_TYPE_LABELS[q.data.type]}</span>
            <span className="text-[10px]" style={{ color: "var(--p-text-ghost)" }}>⏱ {q.data.timer}s</span>
            {q.data.reward && (
              <span className="text-[10px]" style={{ color: "var(--p-text-ghost)" }}>
                {q.data.reward.type === "coins" ? "USD " : "🎟️"}{q.data.reward.value}
              </span>
            )}
            {isDisabled && (
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                style={{ color: "var(--p-warning)", backgroundColor: "color-mix(in srgb, var(--p-warning) 10%, transparent)", borderColor: "color-mix(in srgb, var(--p-warning) 15%, transparent)" }}
              >
                DISABLED
              </span>
            )}
          </div>
          <p className={`text-sm truncate ${isDisabled ? "line-through" : ""}`} style={{ color: isDisabled ? "var(--p-text-ghost)" : "var(--p-text-secondary)" }}>{preview}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-0.5 shrink-0 items-center">
          <button
            onClick={() => onToggleDisable(idx)}
            className="p-1 transition-colors rounded"
            style={{
              color: isDisabled ? "var(--p-warning)" : "var(--p-text-ghost)",
              backgroundColor: isDisabled ? "color-mix(in srgb, var(--p-warning) 10%, transparent)" : "transparent",
            }}
            title={isDisabled ? "Habilitar pregunta" : "Deshabilitar pregunta"}
          >
            {isDisabled ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button
            onClick={() => onEdit(q.id)}
            className="p-1 transition-colors rounded"
            style={{ color: "var(--p-success)", backgroundColor: "color-mix(in srgb, var(--p-success) 5%, transparent)" }}
            title="Editar pregunta"
          >
            <Pencil size={13} />
          </button>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {idx > 0 && (
              <button onClick={() => onMove(idx, idx - 1)} className="p-1 transition-colors" style={{ color: "var(--p-text-ghost)" }} title="Mover arriba">
                <ArrowUp size={13} />
              </button>
            )}
            {idx < totalCount - 1 && (
              <button onClick={() => onMove(idx, idx + 1)} className="p-1 transition-colors" style={{ color: "var(--p-text-ghost)" }} title="Mover abajo">
                <ArrowDown size={13} />
              </button>
            )}
            <button onClick={() => onDuplicate(idx)} className="p-1 transition-colors" style={{ color: "var(--p-text-ghost)" }} title="Duplicar">
              <Copy size={13} />
            </button>
            <button onClick={() => onRemove(idx)} className="p-1 transition-colors" style={{ color: "var(--p-text-ghost)" }} onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }} title="Quitar">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Editor ---

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function DropEditor({ dropId, onBack, onRefresh }: DropEditorProps) {
  const [drop, setDrop] = useState<PanelDrop | null>(null);
  const [allQuestions, setAllQuestions] = useState<PanelQuestion[]>([]);
  const [view, setView] = useState<"editor" | "pick" | "create_question" | "edit_question" | "settings">("editor");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [expandedConfig, setExpandedConfig] = useState(false);
  const [exportJSON, setExportJSON] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Save status indicator
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    const d = getDropById(dropId);
    if (d) setDrop(d);
    setAllQuestions(getQuestions());
  }, [dropId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Save to localStorage immediately (sync), then debounce the server sync
  const save = useCallback((updates: Partial<PanelDrop>) => {
    const updated = updateDrop(dropId, updates);
    if (!updated) return;
    setDrop(updated);

    // Show "saving" right away
    setSaveStatus("saving");
    if (saveResetTimer.current) clearTimeout(saveResetTimer.current);
    if (syncDebounceTimer.current) clearTimeout(syncDebounceTimer.current);

    // Debounce server sync 400ms — avoids firing on every keystroke
    syncDebounceTimer.current = setTimeout(async () => {
      const res = await syncDropNow(dropId);
      if (res.ok) {
        setSaveStatus("saved");
        saveResetTimer.current = setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    }, 400);
  }, [dropId]);

  const moveQuestion = useCallback((fromIdx: number, toIdx: number) => {
    if (!drop) return;
    const ids = [...drop.questionIds];
    const [moved] = ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, moved);
    save({ questionIds: ids });
  }, [drop, save]);

  const removeQuestion = useCallback((idx: number) => {
    if (!drop) return;
    save({ questionIds: drop.questionIds.filter((_, i) => i !== idx) });
  }, [drop, save]);

  const duplicateInDrop = useCallback((idx: number) => {
    if (!drop) return;
    const originalId = drop.questionIds[idx];
    const duped = dupeQ(originalId);
    if (duped) {
      const ids = [...drop.questionIds];
      ids.splice(idx + 1, 0, duped.id);
      save({ questionIds: ids });
      setAllQuestions(getQuestions());
    }
  }, [drop, save]);

  const toggleDisableQuestion = useCallback((idx: number) => {
    if (!drop) return;
    const qId = drop.questionIds[idx];
    const disabled = new Set(drop.disabledQuestionIds || []);
    if (disabled.has(qId)) {
      disabled.delete(qId);
    } else {
      disabled.add(qId);
    }
    save({ disabledQuestionIds: Array.from(disabled) });
  }, [drop, save]);

  const handlePick = useCallback((ids: string[]) => {
    if (!drop) return;
    save({ questionIds: [...drop.questionIds, ...ids] });
    setView("editor");
  }, [drop, save]);

  const handleExport = useCallback(() => {
    if (!drop) return;
    const json = exportDropJSON(drop, allQuestions);
    const str = JSON.stringify(json, null, 2);
    setExportJSON(str);
  }, [drop, allQuestions]);

  const handleDownloadExport = useCallback(() => {
    if (!exportJSON || !drop) return;
    const blob = new Blob([exportJSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${drop.dropId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportJSON, drop]);

  const handleActivate = useCallback(async () => {
    if (!drop) return;
    if (!window.confirm(`¿Publicar "${drop.name}"? Pasa a ser el Drop que juegan todos y el que estaba publicado se cierra.`)) return;
    setPublishing(true);
    setPublishError(null);
    const ok = await publishDropNow(dropId);
    setPublishing(false);
    if (!ok) setPublishError("No se pudo publicar. Mirá el aviso de arriba.");
    refresh();
    onRefresh();
  }, [dropId, drop, refresh, onRefresh]);

  const handlePreview = useCallback(async () => {
    if (!drop) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const tab = window.open("about:blank", "_blank");
      const res = await previewDrop(dropId);
      if (res.ok) {
        if (tab) tab.location.href = res.url;
        else window.location.href = res.url;
      } else {
        tab?.close();
        setPublishError(res.error);
      }
    } catch (_err) {
      setPublishError("Error al publicar preview");
    } finally {
      setPublishing(false);
    }
  }, [drop, allQuestions]);

  const handlePublish = useCallback(async () => {
    if (!drop) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const ok = await publishDropNow(dropId);
      if (ok) {
        refresh();
        setPublishError(null);
      } else {
        setPublishError("Error al publicar");
      }
    } catch (_err) {
      setPublishError("Error al publicar el drop");
    } finally {
      setPublishing(false);
    }
  }, [drop, allQuestions, dropId, refresh]);

  if (!drop) return <p style={{ color: "var(--p-text-faint)" }}>Drop no encontrado</p>;

  // --- Picking questions view ---
  if (view === "pick") {
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView("editor")} className="p-2 transition-colors" style={{ color: "var(--p-text-faint)" }}>
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-lg font-bold" style={{ color: "var(--p-text)" }}>Sumar piezas de la caja de herramientas</h2>
        </div>
        <QuestionLibrary
          onCreateNew={() => setView("create_question")}
          onEdit={(id) => { setEditingQuestionId(id); setView("edit_question"); }}
          onPick={handlePick}
          pickMode
        />
      </div>
    );
  }

  // --- Creating/editing a question inline ---
  if (view === "create_question" || view === "edit_question") {
    return (
      <QuestionBuilder
        editId={view === "edit_question" ? editingQuestionId : null}
        onSaved={(q) => {
          if (view === "create_question") {
            save({ questionIds: [...drop.questionIds, q.id] });
          }
          setAllQuestions(getQuestions());
          setView("editor");
        }}
        onCancel={() => setView("editor")}
      />
    );
  }

  // --- Export view ---
  if (exportJSON !== null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setExportJSON(null)} className="p-2 transition-colors" style={{ color: "var(--p-text-faint)" }}>
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-lg font-bold" style={{ color: "var(--p-text)" }}>Exportar JSON</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(exportJSON); }}
              className="px-3 py-1.5 text-xs rounded-lg transition-colors"
              style={{ border: "1px solid var(--p-border)", color: "var(--p-text-muted)" }}
            >
              Copiar
            </button>
            <button
              onClick={handleDownloadExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors"
              style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
            >
              <Download size={12} /> Descargar .json
            </button>
          </div>
        </div>
        <pre
          className="rounded-xl p-4 text-xs font-mono overflow-auto max-h-[70vh] whitespace-pre-wrap"
          style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)", color: "var(--p-text-secondary)" }}
        >
          {exportJSON}
        </pre>
      </div>
    );
  }

  // --- Main editor ---
  const questionsInDrop = drop.questionIds
    .map((id) => allQuestions.find((q) => q.id === id) || getQuestionById(id))
    .filter((q): q is PanelQuestion => q !== undefined);

  // "cambios sin publicar" — hay ediciones posteriores a la última publicación
  const hasUnpublishedChanges = drop.status === "active" && (
    !drop.lastPublishedAt || drop.updatedAt > drop.lastPublishedAt
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 transition-colors" style={{ color: "var(--p-text-faint)" }}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <input
                className="text-xl font-bold bg-transparent border-none focus:outline-none w-full"
                style={{ color: "var(--p-text)" }}
                value={drop.name}
                onChange={(e) => save({ name: e.target.value })}
                placeholder="Nombre del experimento"
              />
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  drop.status === "active" ? "bg-green-500/20 text-green-400" :
                  drop.status === "archived" ? "" :
                  "bg-yellow-500/20 text-yellow-400"
                }`}
                style={drop.status === "archived" ? { backgroundColor: "var(--p-bg-active)", color: "var(--p-text-faint)" } : undefined}
                >
                  {STATUS_LABEL[drop.status]}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--p-text-ghost)" }}>{questionsInDrop.length} cartas</span>
                <span className="text-xs font-mono" style={{ color: "var(--p-text-ghost)" }}>{drop.dropId}</span>
                {/* Save status indicator */}
                {saveStatus === "saving" && (
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--p-text-ghost)" }}>
                    <Loader2 size={10} className="animate-spin" /> Guardando…
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--p-success)" }}>
                    <Check size={10} /> Guardado
                  </span>
                )}
                {saveStatus === "error" && (
                  <button
                    onClick={() => save({})}
                    className="flex items-center gap-1 text-[10px] transition-opacity hover:opacity-80"
                    style={{ color: "var(--p-danger)" }}
                    title="Error al sincronizar. Click para reintentar."
                  >
                    <AlertCircle size={10} /> Error al guardar · reintentar
                    <RefreshCw size={9} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setExpandedConfig(!expandedConfig)}
              className="p-2 border rounded-lg transition-colors"
              style={{
                backgroundColor: expandedConfig ? "var(--p-accent)" : "transparent",
                color: expandedConfig ? "var(--p-accent-fg)" : "var(--p-text-muted)",
                borderColor: expandedConfig ? "var(--p-accent)" : "var(--p-border)",
              }}
              title="Configuración"
            >
              <Settings size={14} />
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors"
              style={{ border: "1px solid var(--p-border)", color: "var(--p-text-muted)" }}
            >
              <Download size={12} /> Exportar
            </button>
            {drop.status !== "archived" && (
              <button
                onClick={() => save({ status: "archived" })}
                className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors"
                style={{ border: "1px solid var(--p-border)", color: "var(--p-text-muted)" }}
              >
                <Archive size={12} /> Archivar
              </button>
            )}
            <a
              href={`/experimentos/lanzar?drop=${encodeURIComponent(drop.dropId)}`}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors"
              style={{ border: "1px solid var(--p-border)", color: "var(--p-text-muted)" }}
              title="Mandar el link por WhatsApp a un grupo de nodos"
            >
              Mandar
            </a>
            <a
              href={`/resultados/drops/${encodeURIComponent(drop.dropId)}`}
              className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors"
              style={{ border: "1px solid var(--p-border)", color: "var(--p-text-muted)" }}
            >
              Resultados
            </a>
            <button
              onClick={handlePreview}
              disabled={publishing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors"
              style={{ border: "1px solid var(--p-accent)", color: "var(--p-text)" }}
              title="Abre el Drop como lo ve un jugador, aunque esté en borrador. No acredita premios."
            >
              <Eye size={12} /> Probar
            </button>
            {drop.status !== "active" ? (
              <button
                onClick={handleActivate}
                disabled={publishing}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors"
                style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
                title={`${drop.questionIds.length - (drop.disabledQuestionIds || []).length} cartas activas`}
              >
                {publishing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Publicar
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-2 text-xs" style={{ color: "var(--p-success)" }} title="Lo están jugando. Cada cambio se ve al instante en el próximo que entre.">
                <Circle size={8} className="fill-current" /> En juego · los cambios se ven al instante
              </span>
            )}
            {publishError && (
              <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg" style={{ backgroundColor: "color-mix(in srgb, var(--p-danger) 15%, transparent)", color: "var(--p-danger)" }}>
                <AlertCircle size={12} /> {publishError}
              </div>
            )}
          </div>
        </div>

        {/* Configuration panel (collapsible) */}
        {expandedConfig && (
          <div className="rounded-xl p-5 flex flex-col gap-4" style={{ backgroundColor: "var(--p-bg-input)", border: "1px solid var(--p-border-subtle)" }}>
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--p-text)" }}>
              <Settings size={14} /> Configuración del experimento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>Estudio</label>
                <select
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: "var(--p-bg-hover)", border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }}
                  value={drop.studyId ?? ""}
                  onChange={(e) => save({ studyId: e.target.value || null })}
                >
                  <option value="">Sin estudio</option>
                  {getStudies().map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
                <span className="text-[11px]" style={{ color: "var(--p-text-ghost)" }}>Identificador en los links: <span className="font-mono">{drop.dropId}</span></span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>Mensaje si se le acaba el tiempo</label>
                <input
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{ backgroundColor: "var(--p-bg-hover)", border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }}
                  value={drop.timeoutMessage}
                  onChange={(e) => save({ timeoutMessage: e.target.value })}
                />
              </div>
            </div>

            <h4 className="text-xs font-bold uppercase tracking-wider mt-2" style={{ color: "var(--p-text-faint)" }}>Reveal</h4>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>Título reveal</label>
                <textarea
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none min-h-[60px]"
                  style={{ backgroundColor: "var(--p-bg-hover)", border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }}
                  value={drop.reveal.title}
                  onChange={(e) => save({ reveal: { ...drop.reveal, title: e.target.value } })}
                  placeholder="Tu perfil\nde señal"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--p-text-muted)" }}>Descripción reveal</label>
                <textarea
                  className="rounded-lg px-3 py-2 text-sm focus:outline-none min-h-[80px]"
                  style={{ backgroundColor: "var(--p-bg-hover)", border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }}
                  value={drop.reveal.description}
                  onChange={(e) => save({ reveal: { ...drop.reveal, description: e.target.value } })}
                />
              </div>
            </div>

            <h4 className="text-xs font-bold uppercase tracking-wider mt-2" style={{ color: "var(--p-text-faint)" }}>Multiplier Checkpoints</h4>
            <p className="text-xs" style={{ color: "var(--p-text-ghost)" }}>
              Formato: índice de pregunta → multiplicador. Ej: pregunta #5 → x1.25
            </p>
            <div className="flex flex-col gap-2">
              {Object.entries(drop.multiplierCheckpoints).map(([idx, cp]) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-16" style={{ color: "var(--p-text-faint)" }}>Q#{idx}</span>
                  <input
                    className="rounded px-2 py-1 text-xs w-20 focus:outline-none"
                    style={{ backgroundColor: "var(--p-bg-hover)", border: "1px solid var(--p-border-subtle)", color: "var(--p-text)" }}
                    type="number"
                    value={cp.multiplier}
                    step={0.25}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      save({
                        multiplierCheckpoints: {
                          ...drop.multiplierCheckpoints,
                          [idx]: { multiplier: val, label: `x${val}` },
                        },
                      });
                    }}
                  />
                  <span className="text-xs" style={{ color: "var(--p-text-ghost)" }}>{cp.label}</span>
                  <button
                    onClick={() => {
                      const next = { ...drop.multiplierCheckpoints };
                      delete next[idx];
                      save({ multiplierCheckpoints: next });
                    }}
                    className="transition-colors"
                    style={{ color: "var(--p-text-ghost)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--p-danger)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--p-text-ghost)"; }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const nextIdx = questionsInDrop.length > 0 ? String(Math.floor(questionsInDrop.length / 2)) : "5";
                  save({
                    multiplierCheckpoints: {
                      ...drop.multiplierCheckpoints,
                      [nextIdx]: { multiplier: 1.25, label: "x1.25" },
                    },
                  });
                }}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: "var(--p-text-faint)" }}
              >
                <Plus size={12} /> Agregar checkpoint
              </button>
            </div>

            {/* Splash screen config */}
            <SplashEditor splash={drop.splash} onSave={(splash) => save({ splash })} />

            {/* Segment restriction */}
            <DropSegmentSelector
              selectedIds={drop.segmentIds || []}
              onChange={(segmentIds) => save({ segmentIds })}
            />
          </div>
        )}

        {/* Question timeline */}
        <div className="flex items-center justify-between mt-2">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--p-text-muted)" }}>Recorrido</h3>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--p-text-ghost)" }}>Arrastrá las cartas para reordenar</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView("create_question")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors"
              style={{ border: "1px solid var(--p-border)", color: "var(--p-text-muted)" }}
            >
              <FileText size={12} /> Pieza nueva
            </button>
            <button
              onClick={() => setView("pick")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors"
              style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
            >
              <Plus size={12} /> Sumar de la caja
            </button>
          </div>
        </div>

        {questionsInDrop.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-xl" style={{ borderColor: "var(--p-border-subtle)" }}>
            <p className="text-sm mb-3" style={{ color: "var(--p-text-ghost)" }}>Todavía no tiene piezas</p>
            <div className="flex gap-2">
              <button
                onClick={() => setView("create_question")}
                className="px-4 py-2 text-sm rounded-lg transition-colors"
                style={{ border: "1px solid var(--p-border)", color: "var(--p-text-muted)" }}
              >
                Crear pregunta
              </button>
              <button
                onClick={() => setView("pick")}
                className="px-4 py-2 text-sm font-bold rounded-lg transition-colors"
                style={{ backgroundColor: "var(--p-accent)", color: "var(--p-accent-fg)" }}
              >
                Agregar existentes
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {questionsInDrop.map((q, idx) => (
              <DraggableQuestionCard
                key={`${q.id}-${idx}`}
                question={q}
                index={idx}
                totalCount={questionsInDrop.length}
                isCheckpoint={drop.multiplierCheckpoints[String(idx)]}
                isDisabled={(drop.disabledQuestionIds || []).includes(q.id)}
                onMove={moveQuestion}
                onRemove={removeQuestion}
                onDuplicate={duplicateInDrop}
                onEdit={(id) => { setEditingQuestionId(id); setView("edit_question"); }}
                onToggleDisable={toggleDisableQuestion}
              />
            ))}
          </div>
        )}
      </div>
    </DndProvider>
  );
}
