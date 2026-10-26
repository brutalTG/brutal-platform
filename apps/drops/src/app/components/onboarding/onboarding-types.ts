// ============================================================
// ONBOARDING TYPES — Application form step definitions
// ============================================================

export type OnboardingStepType =
  | "intro"
  | "phone"
  | "text_input"
  | "age_selector"
  | "single_choice"
  | "nested_choice"
  | "multi_select"
  | "scale"
  | "free_text"
  | "transition"
  | "compass_rafaga"
  | "compass_reveal"
  | "multiplier_handles"
  | "closing";

export interface BaseStep {
  id: string;
  type: OnboardingStepType;
  /** Phase A = datos duros, Phase B = ADN cultural, compass = rafagas, meta = transition/intro/closing */
  phase: "intro" | "A" | "transition" | "B" | "compass" | "compass_reveal" | "multiplier" | "closing";
}

export interface IntroStep extends BaseStep {
  type: "intro";
  title: string;
  subtitle: string;
}

export interface PhoneStep extends BaseStep {
  type: "phone";
  copy: string;
}

export interface TextInputStep extends BaseStep {
  type: "text_input";
  copy: string;
  placeholder?: string;
  maxLength?: number;
}

export interface AgeSelectorStep extends BaseStep {
  type: "age_selector";
  copy: string;
  min: number;
  max: number;
  /** Message shown when out of range */
  rejectMessage?: string;
}

export interface SingleChoiceStep extends BaseStep {
  type: "single_choice";
  copy: string;
  options: string[];
}

export interface NestedChoiceStep extends BaseStep {
  type: "nested_choice";
  copy: string;
  /** Top-level options. Some have sub-options. */
  options: { label: string; subOptions?: string[] }[];
}

export interface MultiSelectStep extends BaseStep {
  type: "multi_select";
  copy: string;
  options: string[];
  /** min selections required */
  minSelect?: number;
  /** max selections allowed */
  maxSelect?: number;
  /** "exactamente 3" vs "máximo 3" */
  exactCount?: number;
}

export interface ScaleStep extends BaseStep {
  type: "scale";
  copy: string;
  options: { value: number; label: string }[];
}

export interface FreeTextStep extends BaseStep {
  type: "free_text";
  copy: string;
  placeholder?: string;
  minLength?: number;
}

export interface TransitionStep extends BaseStep {
  type: "transition";
  lines: string[];
}

export interface MultiplierHandlesStep extends BaseStep {
  type: "multiplier_handles";
  title: string;
  subtitle: string;
  handles: {
    id: string;
    label: string;
    prefix: string;
    placeholder: string;
    positionBoost: number;
  }[];
}

export interface ClosingStep extends BaseStep {
  type: "closing";
}

export interface CompassRafagaStep extends BaseStep {
  type: "compass_rafaga";
  /** Index into the compass rafagas array (0-4) */
  rafagaIndex: number;
}

export interface CompassRevealStep extends BaseStep {
  type: "compass_reveal";
}

export type OnboardingStep =
  | IntroStep
  | PhoneStep
  | TextInputStep
  | AgeSelectorStep
  | SingleChoiceStep
  | NestedChoiceStep
  | MultiSelectStep
  | ScaleStep
  | FreeTextStep
  | TransitionStep
  | CompassRafagaStep
  | CompassRevealStep
  | MultiplierHandlesStep
  | ClosingStep;

// ── Application data stored ─────────────────────────────────

export interface OnboardingApplication {
  /** Unique application ID */
  applicationId: string;
  /** Phone number with country code */
  phone: string;
  /** Chosen nickname */
  nickname: string;
  /** Age */
  age: number;
  /** Gender identity */
  gender: string;
  /** Location (zone + detail) */
  location: string;
  /** Up to three daily-use platforms. */
  platforms: string[];
  /** Referral code used */
  referredBy?: string;
  /** This user's own referral code */
  referralCode: string;
  /** Queue position */
  queuePosition: number;
  /** Legacy field kept for payload compatibility; no longer changes waitlist order */
  positionBoost: number;
  /** Timestamp */
  createdAt: string;
}
