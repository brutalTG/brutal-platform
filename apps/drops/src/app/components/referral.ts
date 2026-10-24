/** Lightweight web referral capture. Attribution is persisted by the server. */

const STORAGE_KEY = "brutal_referral";

interface ReferralData {
  referrerCode: string | null;
  isReferred: boolean;
  detectedAt: number;
}

export function detectReferral(): ReferralData {
  const params = new URLSearchParams(window.location.search);
  const referrerCode = (params.get("ref") || "").trim() || null;
  const data: ReferralData = {
    referrerCode,
    isReferred: Boolean(referrerCode),
    detectedAt: Date.now(),
  };
  if (referrerCode) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }
  return data;
}

export function getReferralLink(): string {
  const code = (() => {
    try { return localStorage.getItem("brutal_own_referral_code") || ""; } catch { return ""; }
  })();
  const url = new URL("/", window.location.origin);
  if (code) url.searchParams.set("ref", code);
  return url.toString();
}

export function getReferrerCode(): string | null {
  const detected = detectReferral();
  if (detected.referrerCode) return detected.referrerCode;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ReferralData).referrerCode : null;
  } catch {
    return null;
  }
}
