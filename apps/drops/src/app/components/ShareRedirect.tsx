// ============================================================
// COMPARTIR — /compartir?r=<código>
// Link corto que manda el bot: abre WhatsApp para elegir a quién mandarle el Drop, con el texto ya escrito.
// Así el mensaje sale como propio (sin la etiqueta "Reenviado") y con la vista previa de /jugar.
// ============================================================

import { useEffect } from "react";

export default function ShareRedirect() {
  const r = (new URLSearchParams(window.location.search).get("r") ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
  const link = `${window.location.origin}/jugar${r ? `?r=${r}` : ""}`;
  const text = `3 minutos de preguntas incómodas y entrás al sorteo de entradas para el Lolla 🎟\nJugá acá 👉 ${link}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  useEffect(() => { window.location.replace(wa); }, [wa]);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-[380px] text-center">
        <p className="mb-6 font-['Silkscreen'] text-[28px] tracking-widest">BRUTAL</p>
        <a href={wa} className="flex h-[56px] w-full items-center justify-center rounded-full bg-[#E8FF00] font-['Roboto'] text-[17px] font-extrabold text-black">
          MANDÁSELO A TUS AMIGOS
        </a>
      </div>
    </div>
  );
}
