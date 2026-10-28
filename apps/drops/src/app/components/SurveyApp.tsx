// ============================================================
// SURVEY APP — Main survey flow component
// ============================================================

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { RewardEvent } from "./reward-animation";
import type { UserAnswer } from "./archetype-engine";
import type { Question, MultiplierCheckpoint, Drop } from "./drop-types";

// --- Screens ---
import { SplashScreen } from "./splash-screen";
import { CountdownScreen } from "./countdown-screen";
import { TimeoutScreen } from "./timeout-screen";
import { ResultScreen } from "./result-screen";
import { MultiplierUnlockScreen } from "./multiplier-unlock-screen";
import { TrapFailScreen } from "./trap-fail-screen";
import { RevealScreen } from "./reveal-screen";
import { DetectorVerdictScreen } from "./detector-verdict-screen";
import { SharedResultPage, parseSharedResult, buildShareUrl } from "./shared-result-page";
import { ShareCard } from "./share-card";
import { MicroReaction } from "./micro-reaction";
import { ProfileScreen } from "./profile-screen";
import { LeaderboardScreen } from "./leaderboard-screen";

// --- Extracted modules ---
import { preloadVoices } from "./voice-cache";
import { StoryProgressBar, TimerBar, PlayingBadge, StatPills } from "./SurveyHeader";
import { QuestionRenderer } from "./QuestionRenderer";
import { useAnswerPipeline } from "./useAnswerPipeline";
import {
  REACTION_MS,
  pickTimeoutMessage, buildQuestionOptionsMap, FULLSCREEN_TYPES,
} from "./survey-constants";

// --- Services ---
import { markQuestionRendered, getAverageLatency, getInstinctiveCount, getDoubtCount, getTotalTime, formatLatency, resetRecords, getRecords } from "./latency-tracker";
import { getNextDuotonePair } from "./color-generator";
import { startSession as signalStartSession, finalizeSession, exportSessionJSON, updateCurrentPosition } from "./signal-store";
import { computeDimensionsWithOptions, pickArchetype, resolveScoring } from "./archetype-engine";
import { getReferralLink } from "./referral";
import { serverStartSession, uploadResponse, completeSession, uploadSession, waitForUpload, claimRewards, type DetectorVerdict } from "./session-uploader";
import type { DetectorBudget } from "./voice-question";
import { fetchActiveDrop, fetchPreviewDrop } from "./drop-api";
import { AccessNotice } from "./AccessNotice";
import { API_BASE } from "./api-base";
import {
  captureStandaloneAccessToken,
  getStandaloneAccessToken,
  userAuthHeaders,
} from "./access-context";

// ============================================================
// Node Status Gate — uses single GET /gate endpoint
// ============================================================

type NodeStatus = "loading" | "active" | "pending" | "blocked" | "not_found" | "unknown" | "error" | "segment_denied" | "completed" | "access_required" | "invalid_access";

function useNodeGate() {
  const [status, setStatus] = useState<NodeStatus>("loading");
  const [nickname, setNickname] = useState<string | null>(null);
  const [isMinor, setIsMinor] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    async function checkGate() {
      const standaloneToken = captureStandaloneAccessToken();

      // 4. Modo Preview para el Panel de Admin
      const params = new URLSearchParams(window.location.search);
      if (params.has("preview")) {
        console.log("[BRUTAL] Preview mode — skipping node gate");
        setStatus("active");
        return;
      }

      // 5. Si falló la obtención del ID, lo pateamos a /entrar para que reintente
      if (!standaloneToken) {
        setStatus("access_required");
        return; 
      }

      // 6. Consultamos al Backend tu estado real
      try {
        const r = await fetch(`${API_BASE}/gate`, { headers: userAuthHeaders() });
        if (r.status === 401 || r.status === 403) {
          setStatus("invalid_access");
          return;
        }
        const data = await r.json();
        
        console.log("[BRUTAL] Gate response:", data);
        setNickname(data.nickname || null);
        setIsMinor(Boolean(data.isMinor));
        setIsTest(Boolean(data.isTest));

        switch (data.status) {
          case "granted":
            setStatus("active");
            break;
          case "unregistered":
            setStatus("not_found");
            break;
          case "denied":
            if (data.reason === "not-in-segment") setStatus("segment_denied");
            else if (data.reason === "blocked") setStatus("blocked");
            else if (data.reason === "pending") setStatus("pending");
            else setStatus("blocked");
            break;
          case "completed":
            setStatus("completed");
            break;
          default:
            console.warn("[BRUTAL] Unknown gate status:", data.status);
            setStatus("active");
        }
      } catch (err) {
        console.error("[BRUTAL] Gate check failed:", err);
        setStatus("error");
      }
    }

    checkGate();
  }, []);

  return { status, nickname, isMinor, isTest };
}

function NodeGateScreen({ status, nickname }: { status: NodeStatus; nickname: string | null }) {
  if (status === "access_required") return <AccessNotice purpose="drop" />;
  if (status === "invalid_access") return <AccessNotice purpose="drop" invalid />;

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#222] flex items-center justify-center mb-6">
        <span className="text-2xl font-bold text-white font-['Silkscreen']">B</span>
      </div>

      {status === "loading" && (
        <>
          <div className="w-6 h-6 border-2 border-[#333] border-t-white rounded-full animate-spin mb-4" />
          <p className="text-sm text-[#666] font-['Fira_Code']">Verificando acceso...</p>
        </>
      )}

      {status === "pending" && (
        <>
          <h1 className="text-xl font-bold text-white mb-3 font-['Silkscreen']">EN FILA</h1>
          {nickname && <p className="text-sm text-[#888] mb-2">Hola {nickname}</p>}
          <p className="text-sm text-[#666] max-w-[280px] leading-relaxed">
            Tu aplicacion esta siendo revisada. Te vamos a avisar cuando estes adentro.
          </p>
          <div className="mt-6 px-4 py-2 bg-[#111] border border-[#222] rounded-lg">
            <p className="text-[10px] text-[#555] font-['Fira_Code'] uppercase tracking-wider">STATUS: PENDING</p>
          </div>
        </>
      )}

      {status === "blocked" && (
        <>
          <h1 className="text-xl font-bold text-red-400 mb-3 font-['Silkscreen']">BLOQUEADO</h1>
          <p className="text-sm text-[#666] max-w-[280px] leading-relaxed">
            Tu acceso fue revocado. Si crees que es un error, contacta al equipo.
          </p>
          <div className="mt-6 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-[10px] text-red-400 font-['Fira_Code'] uppercase tracking-wider">STATUS: BLOCKED</p>
          </div>
        </>
      )}

      {status === "not_found" && (
        <>
          <h1 className="text-xl font-bold text-yellow-400 mb-3 font-['Silkscreen']">SIN ACCESO</h1>
          <p className="text-sm text-[#666] max-w-[280px] leading-relaxed">
            No encontramos tu aplicacion. Ingresa por /entrar para registrarte primero.
          </p>
          <div className="mt-6 px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-[10px] text-yellow-400 font-['Fira_Code'] uppercase tracking-wider">NO APPLICATION</p>
          </div>
        </>
      )}

      {status === "segment_denied" && (
        <>
          <h1 className="text-xl font-bold text-red-400 mb-3 font-['Silkscreen']">ACCESO DENEGADO</h1>
          <p className="text-sm text-[#666] max-w-[280px] leading-relaxed">
            No tienes acceso a este contenido. Si crees que es un error, contacta al equipo.
          </p>
          <div className="mt-6 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-[10px] text-red-400 font-['Fira_Code'] uppercase tracking-wider">STATUS: SEGMENT DENIED</p>
          </div>
        </>
      )}

      {status === "completed" && (
        <>
          <h1 className="text-xl font-bold text-green-400 mb-3 font-['Silkscreen']">YA JUGASTE</h1>
          <p className="text-sm text-[#666] max-w-[280px] leading-relaxed">
            Ya completaste este Drop. Espera al proximo.
          </p>
          <div className="mt-6 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-[10px] text-green-400 font-['Fira_Code'] uppercase tracking-wider">DROP COMPLETED</p>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <h1 className="text-xl font-bold text-white mb-3 font-['Silkscreen']">NO PUDIMOS VALIDARTE</h1>
          <p className="text-sm text-[#666] max-w-[280px] leading-relaxed">
            Revisá tu conexión y volvé a abrir el link que te enviamos por WhatsApp.
          </p>
        </>
      )}
    </div>
  );
}

// ============================================================
// Drop Loader — never substitutes unpublished sample content
// ============================================================

function useDropLoader() {
  const [drop, setDrop] = useState<Drop | null>(null);
  const [source, setSource] = useState<"server" | "preview" | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchStarted = useRef(false);

  useEffect(() => {
    if (fetchStarted.current) return;
    fetchStarted.current = true;

    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams(window.location.search);
        const isPreview = params.has("preview");

        if (isPreview) {
          const previewDrop = await fetchPreviewDrop();
          if (!cancelled && previewDrop) {
            setDrop(previewDrop);
            setSource("preview");
            setLoading(false);
            return;
          }
        }

        const serverDrop = await fetchActiveDrop();
        if (!cancelled && serverDrop) {
          setDrop(serverDrop);
          setSource("server");
        }
      } catch (err) {
        console.error("[BRUTAL] Drop loader error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { drop, source, loading };
}

// ============================================================
// Main Survey Component
// ============================================================

export default function SurveyApp() {
  const { drop, source, loading: dropLoading } = useDropLoader();
  const { status: nodeStatus, nickname, isMinor, isTest } = useNodeGate();

  // NUEVO: Leemos a qué pantalla intenta ir el usuario
  const params = new URLSearchParams(window.location.search);
  const targetScreen = params.get("screen");
  const isProfileOrLeaderboard = targetScreen === "profile" || targetScreen === "leaderboard";
  const isPreview = params.has("preview");

  // Shared result page intercept
  const sharedResult = parseSharedResult();
  if (sharedResult) return <SharedResultPage data={sharedResult} />;

  if (isPreview && drop) {
    localStorage.removeItem(`brutal_drop_completed_${drop.id}`);
  }

  const hasPlayedLocally = !isTest && drop ? localStorage.getItem(`brutal_drop_completed_${drop.id}`) : null;

  // 1. BLOQUEOS DUROS: Nadie pasa si la app está cargando, si estás baneado o en fila
  if (["loading", "pending", "blocked", "access_required", "invalid_access", "error"].includes(nodeStatus)) {
    return <NodeGateScreen status={nodeStatus} nickname={nickname} />;
  }

  if (isProfileOrLeaderboard) {
    if (nodeStatus === "not_found") return <NodeGateScreen status="not_found" nickname={nickname} />;
    if (targetScreen === "profile") return <ProfileScreen onBack={undefined} onLeaderboard={() => { window.location.search = "?screen=leaderboard"; }} />;
    return <LeaderboardScreen onBack={undefined} onProfile={() => { window.location.search = "?screen=profile"; }} />;
  }

  if (dropLoading) return <NodeGateScreen status="loading" nickname={nickname} />;
  if (!drop || !source) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-xl font-bold text-white mb-3 font-['Silkscreen']">SIN DROP ACTIVO</h1>
        <p className="text-sm text-[#666] max-w-[300px] leading-relaxed">Te vamos a avisar por WhatsApp cuando haya uno disponible para vos.</p>
      </div>
    );
  }

  // 3. BLOQUEOS DE JUEGO: Solo aplican si intentan entrar al Drop
  if (nodeStatus === "segment_denied") {
    return <NodeGateScreen status="segment_denied" nickname={nickname} />;
  }

  // EL ESCUDO FINAL: Si el backend o el celular dicen que ya jugaste, te frena acá
  if (nodeStatus === "completed" || hasPlayedLocally) {
    return <NodeGateScreen status="completed" nickname={nickname} />;
  }
  
  if (nodeStatus === "not_found") return <NodeGateScreen status="not_found" nickname={nickname} />;

  // Si pasó todos los controles, arranca el juego
  return <SurveyCore drop={drop} source={source} isMinor={isMinor} />;
}

// ============================================================
// Survey Core — all logic lives here, receives loaded drop
// ============================================================

function SurveyCore({ drop, source, isMinor }: { drop: Drop; source: string; isMinor: boolean }) {
  // --- Derived from drop (memoized) ---
  const questions: Question[] = drop.questions;
  const totalQuestions = questions.length;
  const MULTIPLIER_CHECKPOINTS = useMemo<Record<number, MultiplierCheckpoint>>(() =>
    Object.fromEntries(Object.entries(drop.multiplierCheckpoints).map(([k, v]) => [Number(k), v])),
    [drop]
  );
  const questionOptionsMap = useMemo(() => buildQuestionOptionsMap(questions), [questions]);

  // --- Deep-link screen routing ---
  const initialScreen = useMemo<ScreenType>(() => {
    const s = new URLSearchParams(window.location.search).get("screen");
    if (s === "profile" || s === "leaderboard") return s;
    return "splash";
  }, []);

  // --- Core state ---
  const [screen, setScreen] = useState<ScreenType>(initialScreen);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [interstitialMessage, setInterstitialMessage] = useState(drop.timeoutMessage || "Brutal eligio por vos.");
  const [resultConfig, setResultConfig] = useState<{ percentage: number; text: string }>({ percentage: 50, text: "" });

  // --- Rewards ---
  const [coins, setCoins] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [rewardEvent, setRewardEvent] = useState<RewardEvent | null>(null);
  const rewardIdRef = useRef(0);

  // --- Multiplier ---
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [pendingMultiplier, setPendingMultiplier] = useState<{ multiplier: number; label: string } | null>(null);
  const [trapPenaltyValue, setTrapPenaltyValue] = useState(0);

  // --- La máquina (cartas de voz con detector) ---
  const detectorPositions = useMemo(() => questions.map((q, i) => (q.type === "voice" && q.detector === true ? i : -1)).filter((i) => i >= 0), [questions]);
  const hasDetector = Boolean(drop.detector) && detectorPositions.length >= 2;
  const [detectorVerdict, setDetectorVerdict] = useState<DetectorVerdict | null | "pending">("pending");

  // --- Micro-reaction ---
  const [reactionText, setReactionText] = useState<string | null>(null);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Refs ---
  const answersRef = useRef<Record<number, UserAnswer>>({});
  const sessionFinalizedRef = useRef(false);
  const firstQuestionAnswered = useRef(false);
  const lastUploadedIndexRef = useRef(-1);

  // --- Duotone colors ---
  const [duotoneColors, setDuotoneColors] = useState({ bg: "#000000", fg: "#FFFFFF" });

  useEffect(() => {
    document.body.style.setProperty("--dynamic-bg", duotoneColors.bg);
    document.body.style.setProperty("--dynamic-fg", duotoneColors.fg);
    document.body.style.backgroundColor = duotoneColors.bg;
    document.body.style.color = duotoneColors.fg;
  }, [duotoneColors]);

  const changeColors = useCallback(() => {
    if (!firstQuestionAnswered.current) return;
    const newPair = getNextDuotonePair();
    setDuotoneColors({ bg: newPair.bg, fg: newPair.fg });
  }, []);

  useEffect(() => { changeColors(); }, [screen, questionIndex, changeColors]);

  // --- Log source ---
  useEffect(() => {
    console.log(`[BRUTAL] Drop loaded from: ${source} — "${drop.name}" (${drop.id}) with ${totalQuestions} questions`);
  }, [drop, source, totalQuestions]);

  // --- Abandon tracking ---
  useEffect(() => {
    const onHidden = () => { if (document.visibilityState === "hidden" && screen === "question") updateCurrentPosition(questionIndex); };
    const onUnload = () => { if (screen === "question") updateCurrentPosition(questionIndex); };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("beforeunload", onUnload);
    return () => { document.removeEventListener("visibilitychange", onHidden); window.removeEventListener("beforeunload", onUnload); };
  }, [screen, questionIndex]);

  // ============================================================
  // Per-card upload: ACTUALIZADO con Multiplicador
  // ============================================================
  useEffect(() => {
    if (questionIndex === 0 && lastUploadedIndexRef.current === -1) return;

    const prevIndex = questionIndex - 1;
    if (prevIndex >= 0 && prevIndex > lastUploadedIndexRef.current) {
      const prevAnswer = answersRef.current[prevIndex];
      const prevQuestion = questions[prevIndex];
      if (prevAnswer && prevQuestion) {
        lastUploadedIndexRef.current = prevIndex;
        // Se envía el multiplicador de este momento para guardarlo en la DB
        uploadResponse(prevQuestion, prevIndex, prevAnswer, drop.id, currentMultiplier);
      }
    }
  }, [questionIndex, questions, drop.id, currentMultiplier]);
  
  // --- Derived ---
  const currentQuestion = questionIndex < totalQuestions ? questions[questionIndex] : null;

  // --- Navigation ---
  const goToNextQuestion = useCallback(() => {
    setRewardEvent(null);
    setReactionText(null);
    if (questionIndex < totalQuestions - 1) {
      setQuestionIndex((i) => i + 1);
      setScreen("question");
    } else {
      setScreen(hasDetector ? "verdict" : "reveal");
    }
  }, [questionIndex, totalQuestions, hasDetector]);

  const advanceWithMultiplierCheck = useCallback(() => {
    const checkpoint = MULTIPLIER_CHECKPOINTS[questionIndex];
    if (checkpoint) {
      setPendingMultiplier(checkpoint);
      setScreen("multiplier");
    } else {
      goToNextQuestion();
    }
  }, [questionIndex, goToNextQuestion, MULTIPLIER_CHECKPOINTS]);

  // --- Answer pipeline ---
  const pipeline = useAnswerPipeline({
    questionIndex,
    questions,
    setCoins, setTickets, setRewardEvent, setReactionText,
    setResultConfig, setScreen: setScreen as (s: string) => void,
    setInterstitialMessage, setTrapPenaltyValue,
    answersRef, rewardIdRef, reactionTimerRef, firstQuestionAnswered,
    advanceWithMultiplierCheck,
  });

  // Mayor o menor: doble o nada duplica o borra los tickets; las otras manos suman multiplicador.
  const onHand = useCallback((r: { mode: "ladder" | "multiplier" | "double"; multiplier: number; busted: boolean; steps: number }) => {
    if (r.mode === "double") {
      if (r.busted) setTickets(0);
      else if (r.multiplier > 1) setTickets((t) => t * 2);
      return;
    }
    if (!r.busted && r.multiplier > 1) setCurrentMultiplier((m) => Math.round(m * r.multiplier * 100) / 100);
  }, []);

  // La voz de la máquina se baja entera apenas arranca la partida: cuando llega la carta, suena al instante.
  const voicesLoaded = useRef(false);
  useEffect(() => {
    if (screen !== "question" || voicesLoaded.current) return;
    voicesLoaded.current = true;
    preloadVoices(questions.flatMap((q) => {
      if (q.type === "voice" && q.speak !== false) return [q.speakText || q.text];
      if (q.type === "dead_drop" && q.machine && q.speakText) return [q.speakText];
      return [];
    }));
  }, [screen, questions]);

  // --- Latency tracking ---
  useEffect(() => {
    if (screen === "question" && currentQuestion) {
      markQuestionRendered(questionIndex, currentQuestion.type);
      updateCurrentPosition(questionIndex);
    }
  }, [screen, questionIndex, currentQuestion]);

  // --- Archetype computation ---
  const computeArchetype = useCallback(() => {
    const reveal = drop.reveal;
    if (!reveal.archetypes || !reveal.scoring || reveal.archetypes.length === 0) return null;
    const avgLatency = getAverageLatency();
    const scoring = resolveScoring(reveal.scoring, questions.map((q) => q.label));
    const dims = computeDimensionsWithOptions(answersRef.current, scoring, avgLatency, questionOptionsMap);
    return pickArchetype(dims, reveal.archetypes);
  }, [drop, questions, questionOptionsMap]);

  // Qué le queda por mentir en la carta de la máquina que tiene enfrente.
  const detectorBudget = useMemo<DetectorBudget | undefined>(() => {
    if (!hasDetector || !drop.detector) return undefined;
    const committed = detectorPositions
      .filter((p) => p < questionIndex)
      .map((p) => answersRef.current[p])
      .filter((a): a is Extract<UserAnswer, { type: "voice" }> => Boolean(a && a.type === "voice" && a.committed))
      .map((a) => a.committed as "truth" | "lie");
    const used = committed.filter((c) => c === "lie").length;
    const remainingLies = Math.max(0, drop.detector.lies - used);
    const remainingItems = Math.max(0, detectorPositions.length - committed.length);
    return { remainingLies, remainingItems, mustLie: remainingLies > 0 && remainingLies >= remainingItems, mustTell: remainingLies <= 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDetector, drop.detector, detectorPositions, questionIndex]);

  // Cierra la partida en el servidor una sola vez (último upload + sesión). Devuelve el veredicto de la máquina.
  const finalizeOnce = useCallback(() => {
    if (sessionFinalizedRef.current) return null;
    sessionFinalizedRef.current = true;
    const lastIdx = totalQuestions - 1;
    const lastAnswer = answersRef.current[lastIdx];
    const lastQuestion = questions[lastIdx];
    if (lastAnswer && lastQuestion && lastIdx > lastUploadedIndexRef.current) {
      lastUploadedIndexRef.current = lastIdx;
      uploadResponse(lastQuestion, lastIdx, lastAnswer, drop.id, currentMultiplier);
    }
    localStorage.setItem(`brutal_drop_completed_${drop.id}`, "true");
    const archetype = computeArchetype();
    const archetypeData = archetype ? { id: archetype.id, title: archetype.title } : undefined;
    const session = finalizeSession(questions, getRecords(), { coins, tickets, multiplier: currentMultiplier }, archetypeData);
    if (session) {
      console.log("[BRUTAL] Session finalized:", exportSessionJSON(session));
      uploadSession(session);
    }
    return completeSession({ archetype_result: archetypeData, bic_scores: session?.signalPairs || null, multiplier: currentMultiplier });
  }, [totalQuestions, questions, drop.id, currentMultiplier, coins, tickets, computeArchetype]);

  useEffect(() => {
    if (screen !== "verdict") return;
    const p = finalizeOnce();
    if (!p) return;
    p.then((r) => setDetectorVerdict(r.detector)).catch(() => setDetectorVerdict(null));
  }, [screen, finalizeOnce]);

  // ====== SCREEN RENDERING ======

  if (screen === "splash") {
    return (
      <SplashScreen
        onEnter={() => setScreen("countdown")}
        totalCards={totalQuestions}
        onProfile={getStandaloneAccessToken() ? () => setScreen("profile") : undefined}
        onLeaderboard={() => setScreen("leaderboard")}
        splash={drop.splash}
      />
    );
  }

  if (screen === "countdown") {
    return (
      <CountdownScreen
        onComplete={() => {
          resetRecords();
          signalStartSession(drop.id, drop.name, "web");
          serverStartSession(drop.id);
          setScreen("question");
        }}
      />
    );
  }

  if (screen === "timeout" || screen === "confession_secret") {
    return <TimeoutScreen message={interstitialMessage} onComplete={advanceWithMultiplierCheck} />;
  }

  if (screen === "result") {
    return <ResultScreen percentage={resultConfig.percentage} text={resultConfig.text} onContinue={advanceWithMultiplierCheck} />;
  }

  if (screen === "multiplier" && pendingMultiplier) {
    return (
      <MultiplierUnlockScreen
        multiplier={pendingMultiplier.label}
        onComplete={() => {
          setCurrentMultiplier(pendingMultiplier.multiplier);
          setPendingMultiplier(null);
          goToNextQuestion();
        }}
      />
    );
  }

  if (screen === "trap_fail") {
    return <TrapFailScreen penaltyValue={trapPenaltyValue} onComplete={advanceWithMultiplierCheck} />;
  }

  if (screen === "verdict") {
    return <DetectorVerdictScreen verdict={detectorVerdict} onContinue={() => setScreen("reveal")} />;
  }

  if (screen === "reveal") {
    const avgLatency = getAverageLatency();
    const instinctive = getInstinctiveCount();
    const doubts = getDoubtCount();
    const totalTime = getTotalTime();
    const archetype = computeArchetype();
    const revealTitle = archetype ? archetype.title : drop.reveal.title;
    const revealDescription = archetype ? archetype.description : drop.reveal.description;

    finalizeOnce();
    const bonusTickets = detectorVerdict && detectorVerdict !== "pending" ? Number(detectorVerdict.tickets) || 0 : 0;

    const referralLink = getReferralLink();
    const shareUrl = buildShareUrl({ title: revealTitle, description: revealDescription, dropName: drop.name, latency: formatLatency(avgLatency), totalTime });
    const finalTickets = Math.max(0, Math.round(tickets * currentMultiplier) + bonusTickets);

    return (
      <RevealScreen
        title={revealTitle}
        description={revealDescription}
        metrics={{ latency: formatLatency(avgLatency), instinctiveResponses: `${instinctive}/${totalQuestions}`, doubtMoments: `${doubts}`, totalTime }}
        coins={coins}
        tickets={tickets}
        multiplier={currentMultiplier}
        bonusTickets={bonusTickets}
        isMinor={isMinor}
        onClaim={() => { setScreen("profile"); }}
        onClaimRewards={async () => {
          try {
            await waitForUpload();
            if (getStandaloneAccessToken()) {
              const result = await claimRewards({
                dropId: drop.id,
                coins: coins, 
                tickets: tickets, 
                finalTickets: finalTickets,
                multiplier: currentMultiplier,
              });
              console.log("[BRUTAL] Claim rewards result:", result);
              return result.ok;
            }
            return true;
          } catch (err) {
            console.error("[BRUTAL] Claim rewards error:", err);
            return false;
          }
        }}
        onNotifyAndClose={async () => { setScreen("profile"); }}
        shareCard={
          <ShareCard
            title={revealTitle}
            description={revealDescription}
            dropName={drop.name}
            metrics={{ latency: formatLatency(avgLatency), instinctiveResponses: `${instinctive}/${totalQuestions}`, totalTime }}
            referralLink={referralLink}
            shareUrl={shareUrl}
          />
        }
      />
    );
  }

  if (screen === "profile") {
    return <ProfileScreen onBack={undefined} onLeaderboard={() => setScreen("leaderboard")} />;
  }

  if (screen === "leaderboard") {
    return <LeaderboardScreen onBack={undefined} onProfile={() => setScreen("profile")} />;
  }
  
  // ====== QUESTION SCREEN ======
  if (screen !== "question" || !currentQuestion) return null;

  // Las cartas de la máquina van a pantalla completa, con el polígrafo arriba.
  if (FULLSCREEN_TYPES.has(currentQuestion.type) || (currentQuestion.type === "voice" && currentQuestion.detector === true)) {
    return (
      <QuestionRenderer
        question={currentQuestion}
        questionIndex={questionIndex}
        pipeline={pipeline}
        reactionText={reactionText}
        advanceWithMultiplierCheck={advanceWithMultiplierCheck}
        setResultConfig={setResultConfig}
        setScreen={setScreen as (s: string) => void}
        detectorBudget={detectorBudget}
        tickets={tickets}
        onHand={onHand}
      />
    );
  }

  const formattedCoins = coins % 1 === 0 ? coins.toString() : coins.toFixed(2).replace(".", ",");
  const formattedTickets = tickets.toLocaleString("es-AR");
  const isPenalty = !!rewardEvent?.penalty;

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
        <div className="w-full mb-3">
          <StoryProgressBar total={totalQuestions} current={questionIndex} />
        </div>

        <div className="w-full flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-['Silkscreen'] text-sm tracking-wide" style={{ color: duotoneColors.fg }}>
                BRUTAL////////////////
              </span>
              {currentMultiplier > 1 && (
                <span
                  className="font-['Fira_Code'] text-[11px] px-2 py-0.5 rounded-full font-bold"
                  style={{ color: duotoneColors.fg, backgroundColor: `${duotoneColors.fg}1a` }}
                >
                  x{currentMultiplier.toFixed(2).replace(/\.?0+$/, "")}
                </span>
              )}
            </div>
            <PlayingBadge />
          </div>

          <div className="flex items-center w-full gap-1.5">
            <div className="w-[45%] shrink-0">
              <TimerBar
                key={questionIndex}
                duration={currentQuestion.timer}
                onTimeUp={() => {
                  pipeline.storeOnly(questionIndex, { type: "timeout", latencyMs: Math.round((currentQuestion.timer || 15) * 1000) });
                  setInterstitialMessage(pickTimeoutMessage());
                  setScreen("timeout");
                }}
              />
            </div>
            <StatPills
              formattedCoins={formattedCoins}
              formattedTickets={formattedTickets}
              rewardEvent={rewardEvent}
              isPenalty={isPenalty}
              isMinor={isMinor}
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-8 overflow-y-auto overflow-x-hidden">
          <QuestionRenderer
            key={questionIndex}
            question={currentQuestion}
            questionIndex={questionIndex}
            pipeline={pipeline}
            reactionText={reactionText}
            advanceWithMultiplierCheck={advanceWithMultiplierCheck}
            setResultConfig={setResultConfig}
            setScreen={setScreen as (s: string) => void}
            detectorBudget={detectorBudget}
            tickets={tickets}
            onHand={onHand}
          />
        </div>
      </div>

      {reactionText && currentQuestion.type !== "hot_take" && currentQuestion.type !== "hot_take_visual" && (
        <MicroReaction text={reactionText} duration={REACTION_MS} />
      )}
    </div>
  );
}

type ScreenType = "splash" | "countdown" | "question" | "result" | "timeout" | "confession_secret" | "multiplier" | "trap_fail" | "verdict" | "reveal" | "profile" | "leaderboard";
