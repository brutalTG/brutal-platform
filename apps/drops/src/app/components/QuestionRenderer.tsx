// ============================================================
// QUESTION RENDERER — Dispatches current question to the right component
// ============================================================

import type { Question } from "./drop-types";
import type { UserAnswer } from "./archetype-engine";
import type { PipelineActions } from "./useAnswerPipeline";
import { MicroReaction } from "./micro-reaction";
import { REACTION_MS, getActionHint } from "./survey-constants";

// --- Question components ---
import { ChoiceQuestion } from "./choice-question";
import { PredictionBetQuestion } from "./prediction-bet-question";
import { RafagaQuestion } from "./rafaga-question";
import { RankingQuestion } from "./ranking-question";
import { ConfesionarioQuestion } from "./confesionario-question";
import { SliderQuestion } from "./slider-question";
import { BinaryMediaQuestion } from "./binary-media-question";
import { TrapQuestion } from "./trap-question";
import { ChoiceEmojiQuestion } from "./choice-emoji-question";
import { ChoiceHybridQuestion } from "./choice-hybrid-question";
import { SliderEmojiQuestion } from "./slider-emoji-question";
import { RafagaEmojiQuestion } from "./rafaga-emoji-question";
import { HotTakeQuestion } from "./hot-take-question";
import { HotTakeVisualQuestion } from "./hot-take-visual-question";
import { MediaReactionQuestion } from "./media-reaction-question";
import { DeadDropScreen } from "./dead-drop-screen";
import { MachineIntroScreen } from "./machine-intro-screen";
import { resolveDeadDrop } from "./dead-drop-resolver";
import { RafagaBurstQuestion } from "./rafaga-burst-question";
import { VoiceQuestion, type DetectorBudget } from "./voice-question";
import { MayorMenorQuestion } from "./mayor-menor-question";

interface Props {
  question: Question;
  questionIndex: number;
  pipeline: PipelineActions;
  reactionText: string | null;
  advanceWithMultiplierCheck: () => void;
  /** For media_reaction: setters needed for inline handler */
  setResultConfig: (cfg: { percentage: number; text: string }) => void;
  setScreen: (s: string) => void;
  /** Carta de la máquina: qué le queda por mentir. */
  detectorBudget?: DetectorBudget;
  /** Tickets que lleva el jugador (para doble o nada). */
  tickets?: number;
  /** Lo que dejó una mano de mayor o menor: duplica/borra tickets o activa un multiplicador. */
  onHand?: (r: { mode: "ladder" | "multiplier" | "double"; multiplier: number; busted: boolean; steps: number }) => void;
}

export function QuestionRenderer({
  question: q, questionIndex, pipeline, reactionText,
  advanceWithMultiplierCheck, setResultConfig, setScreen, detectorBudget, tickets = 0, onHand,
}: Props) {
  const actionHint = getActionHint(q);

  // ---- FULL-SCREEN TYPES (no header) ----

  if (q.type === "dead_drop") {
    pipeline.storeOnly(questionIndex, { type: "dead_drop", latencyMs: 0 });
    if (q.machine) {
      return (
        <MachineIntroScreen
          key={questionIndex}
          title={q.title ?? q.firstLine}
          lines={q.lines ?? []}
          rules={q.rules}
          speakText={q.speakText}
          button={q.button}
          onComplete={advanceWithMultiplierCheck}
        />
      );
    }
    const resolved = resolveDeadDrop(q);
    return (
      <DeadDropScreen
        key={questionIndex}
        firstLine={resolved.firstLine}
        codeLines={resolved.codeLines}
        lastLines={resolved.lastLines}
        onComplete={advanceWithMultiplierCheck}
      />
    );
  }

  if (q.type === "hot_take") {
    return (
      <>
        <HotTakeQuestion
          key={questionIndex}
          text={q.text}
          options={q.options}
          onSelect={(option) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const selectedIndex = q.options.indexOf(option);
            pipeline.submitStandard({ type: "hot_take", selectedIndex, latencyMs });
          }}
        />
        {reactionText && <MicroReaction text={reactionText} duration={REACTION_MS} />}
      </>
    );
  }

  if (q.type === "hot_take_visual") {
    return (
      <>
        <HotTakeVisualQuestion
          key={questionIndex}
          text={q.text}
          options={q.options}
          onSelect={(option) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const selectedIndex = q.options.indexOf(option);
            pipeline.submitStandard({ type: "hot_take", selectedIndex, latencyMs });
          }}
        />
        {reactionText && <MicroReaction text={reactionText} duration={REACTION_MS} />}
      </>
    );
  }

  if (q.type === "media_reaction") {
    const isEmojiMode = q.mode === "emoji";
    const handleMediaAnswer = (answer: UserAnswer) => {
      if (!pipeline.acquireLock()) return;
      pipeline.markFirstAnswered();
      pipeline.submitStandard(answer);
    };
    return (
      <>
        <MediaReactionQuestion
          key={questionIndex}
          imageUrl={q.imageUrl}
          text={q.text}
          mode={q.mode}
          options={q.options}
          onSelectEmoji={isEmojiMode ? (option: string) => {
            const latencyMs = pipeline.captureLatency();
            const selectedIndex = (q.options || []).indexOf(option);
            handleMediaAnswer({ type: "choice", selectedIndex, latencyMs });
          } : undefined}
          labelLeft={q.labelLeft}
          labelRight={q.labelRight}
          min={q.min}
          max={q.max}
          onConfirmSlider={!isEmojiMode ? (value: number) => {
            const latencyMs = pipeline.captureLatency();
            handleMediaAnswer({ type: "slider", value, latencyMs });
          } : undefined}
        />
        {reactionText && <MicroReaction text={reactionText} duration={REACTION_MS} />}
      </>
    );
  }

  // ---- PIEZAS NUEVAS: voz y mayor o menor ----

  if (q.type === "voice") {
    return (
      <VoiceQuestion
        key={questionIndex}
        actionHint={actionHint}
        text={q.text}
        speakText={q.speakText}
        speak={q.speak !== false}
        maxSeconds={q.maxSeconds ?? 20}
        answerType={q.answerType}
        optionA={q.optionA}
        optionB={q.optionB}
        detector={q.detector === true}
        budget={detectorBudget}
        onDone={({ audio, mime, speechMs, latencyMs, committed, decisionMs, text, meta }) => {
          if (!pipeline.acquireLock()) return;
          pipeline.markFirstAnswered();
          pipeline.captureLatency();
          pipeline.submitStandard({ type: "voice", audio, mime, speechMs, latencyMs, committed, decisionMs, text, meta });
        }}
      />
    );
  }

  if (q.type === "mayor_menor") {
    return (
      <MayorMenorQuestion
        key={questionIndex}
        text={q.text}
        position={questionIndex}
        questionId={(q as any).questionId || ""}
        secondsPerCard={q.secondsPerCard ?? 15}
        mode={q.mode ?? "ladder"}
        tickets={tickets}
        allowPass={(q as any).alwaysWin !== true}
        onDone={({ multiplier, busted, steps }) => {
          if (!pipeline.acquireLock()) return;
          onHand?.({ mode: q.mode ?? "ladder", multiplier, busted, steps });
          pipeline.markFirstAnswered();
          const latencyMs = pipeline.captureLatency();
          pipeline.submitStandard({ type: "mayor_menor", multiplier, busted, steps, latencyMs });
        }}
      />
    );
  }

  // ---- STANDARD TYPES (rendered inside header layout) ----

  // Helper para normalizar los items de ráfagas (evita el error 'trigger')
  const rafagaItems = q.items || (q as any).pairs || (q as any).data?.items || [];

  return (
    <>
      {q.type === "choice" && (
        <ChoiceQuestion
          actionHint={actionHint}
          text={q.text}
          options={q.options}
          onSelect={(option) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const selectedIndex = q.options.indexOf(option);
            pipeline.submitStandard({ type: "choice", selectedIndex, latencyMs });
          }}
        />
      )}

      {q.type === "prediction_bet" && (
        <PredictionBetQuestion
          actionHint={actionHint}
          text={q.text}
          optionA={q.optionA}
          optionB={q.optionB}
          maxTickets={q.maxTickets}
          onConfirm={(option, bet) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const side = option === q.optionA ? "A" : "B";
            pipeline.submitStandard({ type: "prediction_bet", side: side as "A" | "B", latencyMs, meta: { bet } });
          }}
        />
      )}

      {q.type === "ranking" && (
        <RankingQuestion
          actionHint={actionHint}
          text={q.text}
          options={q.options}
          onConfirm={(ranked, detail) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            pipeline.submitWithDelay({ type: "ranking", order: ranked, latencyMs, meta: detail }, 300);
          }}
        />
      )}

      {q.type === "confesionario" && (
        <ConfesionarioQuestion
          actionHint={actionHint}
          text={q.text}
          onSubmit={() => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const message = q.interstitialMessage || "Nadie nunca va a saber lo que escribiste.";
            pipeline.submitConfesionario({ type: "confesionario", latencyMs }, message);
          }}
        />
      )}

      {q.type === "slider" && (
        <SliderQuestion
          actionHint={actionHint}
          text={q.text}
          min={q.min}
          max={q.max}
          labelLeft={q.labelLeft}
          labelRight={q.labelRight}
          onConfirm={(value, detail) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            pipeline.submitStandard({ type: "slider", value, latencyMs, meta: detail });
          }}
        />
      )}

      {q.type === "binary_media" && (
        <BinaryMediaQuestion
          imageUrl={q.imageUrl}
          optionA={q.optionA}
          optionB={q.optionB}
          onSelect={(option) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const selectedIndex = option === q.optionA ? 0 : 1;
            pipeline.submitStandard({ type: "choice", selectedIndex, latencyMs });
          }}
        />
      )}

      {q.type === "rafaga" && (
        <RafagaQuestion
          prompt={q.prompt}
          promptBold={q.promptBold}
          items={rafagaItems}
          secondsPerItem={q.secondsPerItem}
          onComplete={(answers) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const abAnswers = answers.map((a, i) => {
              if (a === null) return null;
              const item = rafagaItems[i];
              const optA = item?.optionA || item?.option_a || item?.emoji_left || item?.brand_a;
              const optB = item?.optionB || item?.option_b || item?.emoji_right || item?.brand_b;
              if (a === optA) return "A";
              if (a === optB) return "B";
              return null;
            });
            pipeline.submitStandard({ type: "rafaga", answers: abAnswers, latencyMs });
          }}
        />
      )}

      {q.type === "trap" && (
        <TrapQuestion
          actionHint={actionHint}
          text={q.text}
          options={q.options}
          correctIndex={q.correctIndex}
          onAnswer={(correct, selectedIndex) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            pipeline.submitTrap({ type: "trap", correct, selectedIndex, latencyMs }, correct, q.penalty);
          }}
        />
      )}

      {q.type === "trap_silent" && (
        <ChoiceQuestion
          actionHint={actionHint}
          text={q.text}
          options={q.options}
          onSelect={(option) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const selectedIndex = q.options.indexOf(option);
            const correct = selectedIndex === q.correctIndex;
            pipeline.submitTrapSilent(
              { type: "trap_silent", correct, selectedIndex, latencyMs },
              correct,
              q.penalty
            );
          }}
        />
      )}

      {q.type === "choice_emoji" && (
        <ChoiceEmojiQuestion
          text={q.text}
          options={q.options}
          onSelect={(option) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const selectedIndex = q.options.indexOf(option);
            pipeline.submitStandard({ type: "choice", selectedIndex, latencyMs });
          }}
        />
      )}

      {q.type === "choice_hybrid" && (
        <ChoiceHybridQuestion
          actionHint="Elegi una"
          text={q.text}
          options={q.options}
          onSelect={(option) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const selectedIndex = q.options.indexOf(option);
            pipeline.submitStandard({ type: "choice", selectedIndex, latencyMs });
          }}
        />
      )}

      {q.type === "slider_emoji" && (
        <SliderEmojiQuestion
          text={q.text}
          min={q.min}
          max={q.max}
          labelLeft={q.labelLeft}
          labelRight={q.labelRight}
          onConfirm={(value) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            pipeline.submitStandard({ type: "slider", value, latencyMs });
          }}
        />
      )}

      {q.type === "rafaga_emoji" && (
        <RafagaEmojiQuestion
          promptBold={q.promptBold}
          items={rafagaItems}
          secondsPerItem={q.secondsPerItem}
          onComplete={(answers, itemLatencyMs) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const abAnswers = answers.map((a, i) => {
              if (a === null) return null;
              const item = rafagaItems[i];
              const optA = item?.optionA || item?.option_a || item?.emoji_left || item?.brand_a;
              const optB = item?.optionB || item?.option_b || item?.emoji_right || item?.brand_b;
              if (a === optA) return "A";
              if (a === optB) return "B";
              return null;
            });
            pipeline.submitStandard({ type: "rafaga", answers: abAnswers, latencyMs, meta: { item_latency_ms: itemLatencyMs } });
          }}
        />
      )}

      {q.type === "rafaga_burst" && (
        <RafagaBurstQuestion
          preScreen={q.preScreen}
          items={rafagaItems}
          secondsPerItem={q.secondsPerItem}
          onComplete={(answers) => {
            if (!pipeline.acquireLock()) return;
            pipeline.markFirstAnswered();
            const latencyMs = pipeline.captureLatency();
            const mixedAnswers = answers.map((a) => {
              if (a === null) return null;
              return String(a);
            });
            pipeline.submitStandard({ type: "rafaga_burst", answers: mixedAnswers, latencyMs });
          }}
        />
      )}
    </>
  );
}
