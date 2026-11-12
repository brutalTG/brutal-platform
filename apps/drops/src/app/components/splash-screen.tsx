import { useState, useEffect, useRef } from "react";
import { TicketIcon } from "./ticket-icon";
import { hapticMedium } from "./haptics";
import type { PrizeConfig, SplashConfig } from "./drop-types";
import { BrutalLogo, BrandHeader } from "./brutal-ui";

// Static lines (no animation) — defaults
const DEFAULT_STATIC_LINES = [
  "> Establishing secure connection...",
  "> Encryption: AES-256-GCM",
  "> Anonymity protocol: ACTIVE",
  "> Signal extraction engine: LOADED",
  "> Panel status: RESTRICTED ACCESS",
];

// Typewriter lines builder (dynamic card count) — defaults
function buildDefaultTypewriterLines(totalCards: number) {
  return [
    "> WARNING: Todo lo que pase acá es anónimo.",
    "> No guardamos tu nombre.",
    "> No sabemos quién sos.",
    "> Pero vamos a saber quién sos REALMENTE.",
    "",
    `> ${totalCards} cartas. ~4 min. Golden Tickets.`,
    "",
    "> Tocá ENTRO para comenzar:",
  ];
}

interface SplashScreenProps {
  onEnter: () => void;
  totalCards?: number;
  onProfile?: () => void;
  onLeaderboard?: () => void;
  splash?: SplashConfig;
  /** El premio del Drop: el modo imagen muestra "100 tickets = 1 chance" y la fecha del sorteo. */
  prize?: PrizeConfig;
}

export function SplashScreen({ onEnter, totalCards = 20, onProfile, onLeaderboard, splash, prize }: SplashScreenProps) {
  // If mode is "image", render the image splash
  if (splash?.mode === "image" && splash.imageUrl) {
    return (
      <ImageSplash
        splash={splash}
        prize={prize}
        onEnter={onEnter}
        onProfile={onProfile}
        onLeaderboard={onLeaderboard}
      />
    );
  }

  // Terminal mode (default)
  return (
    <TerminalSplash
      splash={splash}
      totalCards={totalCards}
      onEnter={onEnter}
      onProfile={onProfile}
      onLeaderboard={onLeaderboard}
    />
  );
}

// ── Image Splash Mode ──────────────────────────────────────

function ImageSplash({
  splash,
  prize,
  onEnter,
  onProfile,
  onLeaderboard,
}: {
  splash: SplashConfig;
  prize?: PrizeConfig;
  onEnter: () => void;
  onProfile?: () => void;
  onLeaderboard?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const fontFamily = (splash.fontFamily || "Fira_Code").replace("_", " ");
  const buttonText = splash.buttonText || "ENTRO";
  const buttonBg = splash.buttonBg || "#FFFFFF";
  const buttonTextColor = splash.buttonTextColor || "#000000";
  const lines = (splash.overlayLines ?? []).map((l) => l.trim()).filter(Boolean);
  const perChance = prize?.ticketsPerChance && prize.ticketsPerChance > 0 ? prize.ticketsPerChance : 100;
  const prizeInfo = splash.showPrizeInfo && prize
    ? `${perChance} tickets = 1 chance${prize.drawDate ? ` · sorteo el ${prize.drawDate}` : ""}`
    : null;
  const hasText = lines.length > 0 || Boolean(prizeInfo);

  return (
    <div className="relative h-dvh w-full max-w-[420px] mx-auto overflow-hidden bg-black">
      {/* Background image — center/center, cover for large, contain for small */}
      <img
        src={splash.imageUrl}
        alt=""
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "cover", objectPosition: "center center" }}
        onLoad={() => setLoaded(true)}
      />

      {/* Degradé abajo para que los textos se lean sobre cualquier imagen */}
      {hasText && <div className="absolute inset-x-0 bottom-0 h-[60%] pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.45) 55%, transparent)" }} />}

      {/* Overlay content */}
      <div
        className="absolute inset-0 flex flex-col"
        style={{
          paddingTop: "calc(var(--tg-safe-top, 0px) + 44px)",
          paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)",
          paddingLeft: "20px",
          paddingRight: "20px",
        }}
      >
        {/* Spacer */}
        <div className="flex-1" />

        {/* Textos sobre la imagen: qué es y qué se gana */}
        {(lines.length > 0 || prizeInfo) && (
          <div className="relative mb-5 flex flex-col items-center gap-2 text-center text-white">
            {lines[0] && <p className="font-['Bebas_Neue'] text-[46px] leading-[0.95] tracking-wide" style={{ textShadow: "0 2px 18px rgba(0,0,0,0.6)" }}>{lines[0]}</p>}
            {lines.slice(1).map((l) => (
              <p key={l} className="font-['Roboto'] font-bold text-[18px] leading-snug" style={{ textShadow: "0 1px 10px rgba(0,0,0,0.7)" }}>{l}</p>
            ))}
            {prizeInfo && (
              <div className="mt-1 flex items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                <TicketIcon className="w-[22px] h-[18px]" style={{ color: "#E8FF00" }} />
                <span className="font-['Roboto'] font-bold text-[15px]">{prizeInfo}</span>
              </div>
            )}
          </div>
        )}

        {/* Button */}
        <button
          onClick={onEnter}
          className="w-full h-[60px] rounded-full flex items-center justify-center active:scale-[0.98] transition-transform"
          onClickCapture={() => hapticMedium()}
          style={{
            backgroundColor: buttonBg,
            opacity: loaded ? 1 : 0.3,
            pointerEvents: loaded ? "auto" : "none",
            transition: "opacity 0.4s ease",
          }}
        >
          <span
            className="font-semibold text-[18px]"
            style={{ color: buttonTextColor, fontFamily }}
          >
            {buttonText}
          </span>
        </button>

        {/* Bases y condiciones (el ranking y el perfil ya no van acá) */}
        <a href="/bases" className="block text-center mt-4 text-[12px] text-white/60 underline hover:text-white transition-colors" style={{ fontFamily }}>
          Bases y condiciones
        </a>
      </div>
    </div>
  );
}

// ── Terminal Splash Mode ───────────────────────────────────

function TerminalSplash({
  splash,
  totalCards,
  onEnter,
  onProfile,
  onLeaderboard,
}: {
  splash?: SplashConfig;
  totalCards: number;
  onEnter: () => void;
  onProfile?: () => void;
  onLeaderboard?: () => void;
}) {
  const [visibleChars, setVisibleChars] = useState(0);
  const [typewriterDone, setTypewriterDone] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fontFamily = (splash?.fontFamily || "Fira_Code").replace("_", " ");
  const buttonText = splash?.buttonText || "ENTRO";
  const buttonBg = splash?.buttonBg || "#FFFFFF";
  const buttonTextColor = splash?.buttonTextColor || "#000000";

  const staticLines = splash?.staticLines && splash.staticLines.length > 0
    ? splash.staticLines
    : DEFAULT_STATIC_LINES;

  const typewriterLines = splash?.typewriterLines && splash.typewriterLines.length > 0
    ? splash.typewriterLines
    : buildDefaultTypewriterLines(totalCards);

  const fullTypewriterText = typewriterLines.join("\n");
  const totalCharsCount = fullTypewriterText.length;

  useEffect(() => {
    const startDelay = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setVisibleChars((prev) => {
          if (prev >= totalCharsCount) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setTypewriterDone(true);
            return totalCharsCount;
          }
          return prev + 1;
        });
      }, 35);
    }, 400);
    return () => {
      clearTimeout(startDelay);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [totalCharsCount, fullTypewriterText]);

  useEffect(() => {
    const blink = setInterval(() => setCursorVisible((v) => !v), 530);
    return () => clearInterval(blink);
  }, []);

  const revealedText = fullTypewriterText.slice(0, visibleChars);
  const revealedLines = revealedText.split("\n");

  return (
    <div
      className="flex flex-col h-dvh bg-[#000] px-5 max-w-[420px] mx-auto w-full overflow-hidden"
      style={{
        paddingTop: "calc(var(--tg-safe-top, 0px) + 44px)",
        paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)",
      }}
    >
      {/* Logo */}
      <div className="mb-5">
        <BrutalLogo />
      </div>

      {/* Brand + System line */}
      <div className="mb-5">
        <BrandHeader />
        <br />
        <span className="font-medium text-white text-[14px] leading-[22px]" style={{ fontFamily }}>
          SECURE SYSTEM 1:09:35 PM
        </span>
      </div>

      {/* Static lines */}
      <div className="mb-1">
        {staticLines.map((line, i) => (
          <p
            key={i}
            className="font-medium text-white text-[14px] leading-[22px] whitespace-pre-wrap"
            style={{ fontFamily }}
          >
            {line}
          </p>
        ))}
      </div>

      {/* Blank line separator */}
      <div className="h-[44px]" />

      {/* Typewriter lines */}
      <div className="min-h-[220px]">
        {revealedLines.map((line, i) => (
          <p
            key={i}
            className="font-medium text-white text-[14px] leading-[22px] whitespace-pre-wrap"
            style={{ fontFamily }}
          >
            {line === "" ? "\u00A0" : line}
            {i === revealedLines.length - 1 && !typewriterDone && (
              <span
                className="inline-block w-[8px] h-[16px] bg-white ml-[1px] align-middle"
                style={{ opacity: cursorVisible ? 1 : 0 }}
              />
            )}
          </p>
        ))}
        {typewriterDone && (
          <span
            className="inline-block w-[8px] h-[16px] bg-white ml-[1px] align-middle"
            style={{ opacity: cursorVisible ? 1 : 0 }}
          />
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Button */}
      <button
        onClick={onEnter}
        className="w-full h-[60px] rounded-full flex items-center justify-center active:scale-[0.98] transition-transform"
        onClickCapture={() => hapticMedium()}
        style={{
          backgroundColor: buttonBg,
          opacity: typewriterDone ? 1 : 0.3,
          pointerEvents: typewriterDone ? "auto" : "none",
          transition: "opacity 0.4s ease",
        }}
      >
        <span
          className="font-semibold text-[18px]"
          style={{ color: buttonTextColor, fontFamily }}
        >
          {buttonText}
        </span>
      </button>

      {/* Bases y condiciones (el ranking y el perfil ya no van acá) */}
      <a href="/bases" className="block text-center mt-4 text-[12px] text-white/60 underline hover:text-white transition-colors" style={{ fontFamily }}>
        Bases y condiciones
      </a>
    </div>
  );
}
