import { API_BASE } from "../api-base";
// ============================================================
// ONBOARDING APP — Main application form flow at /entrar
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import svgPaths from "../../../imports/svg-mcipxppzoz";
import { getNextDuotonePair } from "../color-generator";
import { getReferrerCode } from "../referral";
import { hapticMedium } from "../haptics";
import { ONBOARDING_STEPS, mergeOnboarding } from "./onboarding-data";
import { submitApplication } from "./onboarding-api";
import { AccessNotice } from "../AccessNotice";
import {
  captureStandaloneAccessToken,
  fetchStandaloneAccessContext,
  userAuthHeaders,
} from "../access-context";
import {
  IntroStepView, TextInputStepView, AgeSelectorStepView,
  SingleChoiceStepView, NestedChoiceStepView, MultiSelectStepView,
  ClosingStepView, AgeRejectScreen,
} from "./OnboardingSteps";

// ── Progress bar ────────────────────────────────────────────

function OnboardingProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-[3px] w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-[3px] flex-1 rounded-full transition-all duration-300"
          style={{
            backgroundColor: "var(--dynamic-fg, #fff)",
            opacity: i <= current ? 0.9 : 0.15,
          }}
        />
      ))}
    </div>
  );
}

// ── BRUTAL Logo (reused from splash) ────────────────────────

function BrutalLogoSmall() {
  return (
    <svg width="24" height="24" viewBox="0 0 41 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g>
        <path d={svgPaths.p129e0f00} fill="currentColor" />
        <path d={svgPaths.p28b23600} fill="currentColor" />
        <path d={svgPaths.p2de5a800} fill="currentColor" />
        <path d={svgPaths.pca92a80} fill="currentColor" />
        <path d={svgPaths.p1f938400} fill="currentColor" />
        <path d={svgPaths.p377956f0} fill="currentColor" />
        <path d={svgPaths.p1082f800} fill="currentColor" />
        <path d={svgPaths.pd01a700} fill="currentColor" />
        <path d={svgPaths.p14e44f00} fill="currentColor" />
        <path d={svgPaths.p31786300} fill="currentColor" />
        <path d={svgPaths.p10e83600} fill="currentColor" />
        <path d={svgPaths.p6a77000} fill="currentColor" />
      </g>
    </svg>
  );
}

// ── Main Component ──────────────────────────────────────────

export default function OnboardingApp() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [accessState, setAccessState] = useState<"loading" | "ready" | "missing" | "invalid">("loading");
  const [ageRejected, setAgeRejected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    queuePosition: number;
    referralCode: string;
    nextAction: "drop" | "waitlist";
    dropUrl: string | null;
    dropName: string | null;
  } | null>(null);
  const [duotoneColors, setDuotoneColors] = useState({ bg: "#000000", fg: "#FFFFFF" });
  const firstStepDone = useRef(false);

  // --- LÓGICA DE REANUDACIÓN INTELIGENTE ---
  const [isInitializing, setIsInitializing] = useState(true);
  const [allSteps, setAllSteps] = useState(ONBOARDING_STEPS);
  useEffect(() => {
    async function checkExistingProgress() {
      try {
        const accessToken = captureStandaloneAccessToken();
        if (!accessToken) {
          setAccessState("missing");
          return;
        }

        await fetchStandaloneAccessContext("onboarding");
        setAnswers((current) => ({ ...current, phone: "whatsapp_verified" }));
        const res = await fetch(`${API_BASE}/apply/init`, {
          method: "POST",
          headers: userAuthHeaders(),
          body: JSON.stringify({ phone: "whatsapp_verified" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "invalid_access");
        const merged = mergeOnboarding(data.onboarding);
        setAllSteps(merged);
        setAccessState("ready");
        if (data.nextAction === "drop" && data.dropUrl) {
          window.location.replace(data.dropUrl);
          return;
        }
        if (data.nextAction === "waitlist") {
          const steps = merged.filter((step) => step.type !== "phone");
          setStepIndex(Math.max(0, steps.length - 1));
          setSubmitResult({
            queuePosition: 0,
            referralCode: data.referralCode || "",
            nextAction: "waitlist",
            dropUrl: null,
            dropName: null,
          });
        }
      } catch (err) {
        console.error("[BRUTAL] Error al chequear progreso:", err);
        setAccessState("invalid");
      } finally {
        setIsInitializing(false);
      }
    }

    checkExistingProgress();
  }, []);

  // Duotone sync
  useEffect(() => {
    document.body.style.setProperty("--dynamic-bg", duotoneColors.bg);
    document.body.style.setProperty("--dynamic-fg", duotoneColors.fg);
    document.body.style.backgroundColor = duotoneColors.bg;
    document.body.style.color = duotoneColors.fg;
  }, [duotoneColors]);

  const changeColors = useCallback(() => {
    if (!firstStepDone.current) return;
    const pair = getNextDuotonePair();
    setDuotoneColors({ bg: pair.bg, fg: pair.fg });
  }, []);

  // Change colors on step change
  useEffect(() => {
    changeColors();
  }, [stepIndex, changeColors]);

  const activeSteps = useMemo(() => allSteps.filter((step) => step.type !== "phone"), [allSteps]);
  const currentStep = activeSteps[stepIndex];
  const totalSteps = activeSteps.length;

  // Count progress
  const questionSteps = activeSteps.filter((s) => s.phase === "A");
  const currentQuestionIndex = questionSteps.indexOf(currentStep);
  const isQuestionStep = currentQuestionIndex >= 0;

  const advance = useCallback((id: string, value: any) => {
    firstStepDone.current = true;
    setAnswers((prev) => ({ ...prev, [id]: value }));
    hapticMedium();
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, totalSteps]);

  const advanceNoValue = useCallback(() => {
    firstStepDone.current = true;
    hapticMedium();
    if (stepIndex < totalSteps - 1) {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, totalSteps]);

  // Submit application
  useEffect(() => {
    if (currentStep && currentStep.type === "closing" && !submitResult && !submitting && !submitError) {
      setSubmitting(true);
      const doSubmit = async () => {
        try {
          const result = await submitApplication({
            phone: answers.phone || "",
            nickname: answers.nickname || "",
            age: answers.age || 0,
            gender: answers.gender || "",
            location: answers.location || "",
            platforms: answers.platforms || [],
            referralCode: "",
            referredBy: getReferrerCode() || undefined,
            positionBoost: 0,
          });

          if (result.ok) {
            if (result.referralCode) {
              try { localStorage.setItem("brutal_own_referral_code", result.referralCode); } catch {}
            }
            setSubmitResult({
              queuePosition: result.queuePosition || 0,
              referralCode: result.referralCode || "",
              nextAction: result.nextAction || "waitlist",
              dropUrl: result.dropUrl || null,
              dropName: result.dropName || null,
            });
          } else {
            console.error("[ONBOARDING] Submit failed:", result.error);
            setSubmitError("No pudimos guardar tu perfil. Revisá tu conexión e intentá de nuevo.");
          }
        } catch (err) {
          console.error("[ONBOARDING] Submit error:", err);
          setSubmitError("No pudimos guardar tu perfil. Revisá tu conexión e intentá de nuevo.");
        } finally {
          setSubmitting(false);
        }
      };
      doSubmit();
    }
  }, [currentStep, submitResult, submitting, submitError, answers]);

  if (isInitializing) {
    return (
      <div className="h-dvh flex flex-col justify-center items-center font-['Roboto'] bg-black text-white">
        <div className="w-8 h-8 border-2 border-[#333] border-t-white rounded-full animate-spin mb-4" />
        <p className="font-['Fira_Code'] text-[12px] opacity-60">Cargando tu perfil...</p>
      </div>
    );
  }

  if (accessState === "missing") return <AccessNotice purpose="onboarding" />;
  if (accessState === "invalid") return <AccessNotice purpose="onboarding" invalid />;

  if (ageRejected) {
    return (
      <div
        className="h-dvh flex justify-center font-['Roboto'] overflow-hidden"
        style={{ backgroundColor: duotoneColors.bg, color: duotoneColors.fg }}
      >
        <div className="w-full max-w-[420px] flex flex-col h-dvh px-5"
          style={{ paddingTop: "calc(var(--tg-safe-top, 0px) + 24px)", paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)" }}>
          <AgeRejectScreen message={ageRejected} />
        </div>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep.type) {
      case "intro":
        return <IntroStepView step={currentStep} onNext={advanceNoValue} />;
      case "text_input":
        return <TextInputStepView step={currentStep} onNext={(val) => advance(currentStep.id, val)} />;
      case "age_selector":
        return (
          <AgeSelectorStepView
            step={currentStep}
            onNext={(val) => advance("age", val)}
            onReject={(msg) => setAgeRejected(msg)}
          />
        );
      case "single_choice":
        return <SingleChoiceStepView step={currentStep} onNext={(val) => advance(currentStep.id, val)} />;
      case "nested_choice":
        return <NestedChoiceStepView step={currentStep} onNext={(val) => advance(currentStep.id, val)} />;
      case "multi_select":
        return <MultiSelectStepView step={currentStep} onNext={(val) => advance(currentStep.id, val)} />;
      case "closing":
        if (submitError) {
          return (
            <div className="flex flex-col flex-1 justify-center items-center px-6 text-center">
              <h1 className="font-['Silkscreen'] text-[24px] mb-5" style={{ color: "var(--dynamic-fg, #fff)" }}>
                NO SE GUARDÓ
              </h1>
              <p className="font-['Fira_Code'] text-[13px] leading-relaxed opacity-70 mb-8" style={{ color: "var(--dynamic-fg, #fff)" }}>
                {submitError}
              </p>
              <button
                onClick={() => setSubmitError(null)}
                className="w-full max-w-[300px] h-[58px] rounded-[14px] font-bold"
                style={{ backgroundColor: "var(--dynamic-fg, #fff)", color: "var(--dynamic-bg, #000)" }}
              >
                Reintentar
              </button>
            </div>
          );
        }
        if (submitting || !submitResult) {
          return (
            <div className="flex flex-col flex-1 justify-center items-center">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "var(--dynamic-fg, #fff)", borderTopColor: "transparent" }} />
              <p className="font-['Fira_Code'] text-[12px] mt-4 opacity-60" style={{ color: "var(--dynamic-fg, #fff)" }}>
                Procesando tu aplicacion...
              </p>
            </div>
          );
        }
        return (
          <ClosingStepView
            dropUrl={submitResult.nextAction === "drop" ? submitResult.dropUrl : null}
            dropName={submitResult.dropName}
          />
        );
      default:
        return null;
    }
  };

  const isFullBleed = currentStep.type === "intro" || currentStep.type === "closing";

  return (
    <div
      className="h-dvh flex justify-center font-['Roboto'] overflow-hidden"
      style={{ backgroundColor: duotoneColors.bg, color: duotoneColors.fg }}
    >
      <div
        className="w-full max-w-[420px] flex flex-col h-dvh px-5 overflow-hidden"
        style={{
          paddingTop: "calc(var(--tg-safe-top, 0px) + 24px)",
          paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 24px)",
        }}
      >
        {!isFullBleed && (
          <>
            {isQuestionStep && (
              <div className="w-full mb-3">
                <OnboardingProgressBar current={currentQuestionIndex} total={questionSteps.length} />
              </div>
            )}
            <div className="flex items-center gap-2 mb-5">
              <div style={{ color: duotoneColors.fg }}>
                <BrutalLogoSmall />
              </div>
              <span className="font-['Silkscreen'] text-[12px] tracking-wide" style={{ color: duotoneColors.fg }}>
                BRUTAL////////////////
              </span>
            </div>
          </>
        )}

        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}
