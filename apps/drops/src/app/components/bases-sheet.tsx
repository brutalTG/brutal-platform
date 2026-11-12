// ============================================================
// BASES Y CONDICIONES — popup para el celular
// Sube desde abajo, se lee con letra grande y se cierra fácil: la X de arriba, el botón grande de abajo,
// tocando afuera o con "atrás" del teléfono. No saca a la persona del Drop.
// ============================================================

import { useEffect, useState } from "react";
import { BasesContent } from "./BasesPage";

export function BasesLink({ className, style, label = "Bases y condiciones" }: { className?: string; style?: React.CSSProperties; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}>{label}</button>
      {open && <BasesSheet onClose={() => setOpen(false)} />}
    </>
  );
}

export function BasesSheet({ onClose }: { onClose: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setShown(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // "Atrás" del teléfono cierra el popup en vez de salir del Drop.
    history.pushState({ bases: true }, "");
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => { document.body.style.overflow = prev; window.removeEventListener("popstate", onPop); };
  }, []);
  const close = () => { if (history.state?.bases) history.back(); else onClose(); };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="Bases y condiciones">
      <div className="absolute inset-0 bg-black/70 transition-opacity duration-300" style={{ opacity: shown ? 1 : 0 }} onClick={close} />
      <div
        className="relative flex max-h-[88dvh] w-full max-w-[480px] mx-auto flex-col rounded-t-[24px] bg-[#141414] text-white transition-transform duration-300"
        style={{ transform: shown ? "translateY(0)" : "translateY(100%)" }}
      >
        <div className="flex items-center justify-between px-5 pt-3 pb-3 border-b border-white/10">
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/25" />
          <h1 className="mt-2 font-['Roboto'] text-[20px] font-extrabold">Bases y condiciones</h1>
          <button onClick={close} aria-label="Cerrar" className="mt-2 flex size-11 items-center justify-center rounded-full bg-white/10 text-[22px] leading-none active:scale-95">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-4">
          <p className="mb-6 font-['Fira_Code'] text-[12px] text-white/50">Versión provisoria · noviembre de 2026</p>
          <BasesContent />
        </div>
        <div className="px-5 pt-3 border-t border-white/10" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
          <button onClick={close} className="h-[56px] w-full rounded-full bg-white font-['Roboto'] text-[17px] font-extrabold text-black active:scale-[0.98]">
            Entendido, volver
          </button>
        </div>
      </div>
    </div>
  );
}
