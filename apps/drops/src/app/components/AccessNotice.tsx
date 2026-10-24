import type { AccessPurpose } from "./access-context";

export function AccessNotice({
  purpose,
  invalid = false,
}: {
  purpose: AccessPurpose;
  invalid?: boolean;
}) {
  const isOnboarding = purpose === "onboarding";
  const title = invalid
    ? "ESTE LINK YA NO SIRVE"
    : isOnboarding
      ? "ENTRÁ DESDE WHATSAPP"
      : "ABRÍ TU LINK DE WHATSAPP";
  const copy = invalid
    ? "Volvé al chat de BRUTAL en WhatsApp y pedí un link nuevo."
    : isOnboarding
      ? "El bot te envía un acceso personal que ya trae tu número verificado."
      : "Cada Drop tiene un acceso personal. Volvé al chat de BRUTAL en WhatsApp y tocá el link que te enviamos.";

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center px-6 text-white">
      <div className="w-full max-w-[380px] border border-white/15 rounded-[28px] p-7 bg-white/[0.04]">
        <p className="font-['Silkscreen'] text-[11px] tracking-widest text-white/40 mb-8">
          BRUTAL////////////////
        </p>
        <p className="font-['Fira_Code'] text-[11px] tracking-[0.18em] text-[#ffbd16] mb-3">
          ACCESO PERSONAL
        </p>
        <h1 className="font-['Silkscreen'] text-[25px] leading-tight mb-5">{title}</h1>
        <p className="font-['Fira_Code'] text-[13px] leading-relaxed text-white/60">{copy}</p>
      </div>
    </div>
  );
}
