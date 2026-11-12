// ============================================================
// PANTALLA FINAL — el premio y el botón para reclamar
// ============================================================
// Sin perfil ni métricas: el premio que se sortea, los tickets que ganaste y un botón que abre WhatsApp.
// - Vino de un anuncio (invitado web): el mensaje armado lleva el código; recién ahí los tickets quedan a su nombre.
// - Ya tenía WhatsApp: los tickets se acreditan solos al llegar acá y el botón abre el chat con el bot.
// ============================================================

import { useEffect, useRef, useState } from "react";
import type { PrizeConfig } from "./drop-types";
import type { WebClaim } from "./session-uploader";
import { TicketIcon } from "./reveal-screen";
import { useCountUp } from "./use-count-up";
import { hapticHeavy } from "./haptics";

interface Props {
  prize?: PrizeConfig;
  tickets: number;
  /** Acredita (o pide el código de reclamo). Devuelve si salió bien. */
  onClaim: () => Promise<boolean>;
  webClaim: WebClaim | null;
  /** Chat con el bot para quien ya tiene WhatsApp. */
  botUrl: string | null;
}

const YELLOW = "#E8FF00";

export function FinalScreen({ prize, tickets, onClaim, webClaim, botUrl }: Props) {
  const [state, setState] = useState<"claiming" | "ready" | "error">("claiming");
  const started = useRef(false);
  const shown = useCountUp(state === "claiming" ? 0 : tickets);
  const perChance = prize?.ticketsPerChance && prize.ticketsPerChance > 0 ? prize.ticketsPerChance : 100;

  async function claim() {
    setState("claiming");
    setState((await onClaim()) ? "ready" : "error");
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    claim();
  }, []);

  const url = webClaim?.url ?? botUrl;
  const lines = prize?.lines?.filter(Boolean) ?? [];

  return (
    <div className="min-h-dvh w-full bg-black text-white flex justify-center"
      style={{ paddingTop: "var(--tg-safe-top, 0px)", paddingBottom: "var(--tg-safe-bottom, 0px)" }}>
      <div className="w-full max-w-[420px] flex flex-col px-6 pt-5 pb-8">
        <p className="font-['Roboto'] font-bold text-[24px] tracking-tight">Brutal™</p>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
          {prize?.imageUrl ? (
            <img src={prize.imageUrl} alt={prize.title ?? "Premio"} className="max-h-[190px] max-w-[240px] object-contain" />
          ) : prize?.title ? (
            <p className="font-['Bebas_Neue'] text-[64px] leading-[0.9] text-center">{prize.title}</p>
          ) : null}

          {lines.length > 0 && (
            <div className="text-center">
              {lines.map((l) => <p key={l} className="font-['Bebas_Neue'] text-[40px] leading-[1.05]">{l}</p>)}
            </div>
          )}
          {prize?.drawDate && <p className="font-['Roboto'] font-bold text-[17px] text-white/60 -mt-4">sortea el {prize.drawDate}</p>}

          <div className="w-full rounded-[24px] bg-[#232323] py-5 flex flex-col items-center gap-1">
            <p className="font-['Roboto'] font-bold text-[17px] text-white/60">Tus tickets</p>
            <div className="flex items-center gap-4">
              <TicketIcon className="w-[52px] h-[42px]" style={{ color: YELLOW }} />
              <span className="font-['Roboto'] font-black text-[52px] leading-none tabular-nums">{shown.toLocaleString("es-AR")}</span>
            </div>
            <p className="font-['Roboto'] text-[16px] text-white/50">{perChance} tickets = 1 chance</p>
          </div>

          {state === "error" ? (
            <button onClick={claim} className="w-full h-[78px] rounded-full font-['Roboto'] font-black text-[22px] text-black active:scale-[0.98]" style={{ backgroundColor: YELLOW }}>
              Probar de nuevo
            </button>
          ) : (
            <a
              href={state === "ready" && url ? url : undefined}
              onClick={() => hapticHeavy()}
              aria-disabled={state !== "ready" || !url}
              className="w-full h-[78px] rounded-full flex items-center justify-center font-['Roboto'] font-black text-[22px] text-black select-none active:scale-[0.98] transition-opacity"
              style={{ backgroundColor: YELLOW, opacity: state === "ready" && url ? 1 : 0.5 }}
              data-testid="reclamar"
            >
              {state === "claiming" ? "Sumando tus tickets…" : "Reclamá tus tickets"}
            </a>
          )}

          {webClaim && !webClaim.url && state === "ready" && (
            <p className="font-['Fira_Code'] text-[14px] font-bold text-center">Mandá #{webClaim.code} al WhatsApp de BRUTAL.</p>
          )}
          {webClaim && (
            <p className="font-['Roboto'] text-[15px] text-white/70 text-center leading-snug -mt-2">
              Por cada amigo que juegue el Drop con tu link sumás <b className="text-white">+{webClaim.referralTickets}</b> tickets. El link te llega por WhatsApp.
            </p>
          )}
        </div>

        <p className="font-['Roboto'] text-[14px] text-white/60 text-center leading-snug">
          No vendemos nada, nunca Brutal te va a pedir datos personales o de tarjeta de crédito.
        </p>
        <a href="/bases" className="mt-3 font-['Roboto'] text-[13px] text-white/40 underline text-center">Bases y condiciones</a>
      </div>
    </div>
  );
}
