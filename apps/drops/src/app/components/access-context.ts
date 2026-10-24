import { API_BASE } from "./api-base";
// ============================================================
// STANDALONE ACCESS — WhatsApp link bootstrap and auth headers
// ============================================================

const ACCESS_STORAGE_KEY = "brutal_standalone_access";

export type AccessPurpose = "onboarding" | "drop";

export interface StandaloneAccessContext {
  ok: true;
  purpose: AccessPurpose;
  expiresAt: string;
  phoneLast4?: string;
  nodeId?: string;
  nickname?: string | null;
  dropId?: string | null;
  isMinor?: boolean;
  isTest?: boolean;
}

/**
 * Capture the opaque token from a WhatsApp link once, then remove it from the
 * visible URL so it is not copied accidentally or kept in browser history.
 */
export function captureStandaloneAccessToken(): string {
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("access");
    if (token) {
      sessionStorage.setItem(ACCESS_STORAGE_KEY, token);
      url.searchParams.delete("access");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      return token;
    }
    return sessionStorage.getItem(ACCESS_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function getStandaloneAccessToken(): string {
  try {
    return sessionStorage.getItem(ACCESS_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function clearStandaloneAccessToken(): void {
  try {
    sessionStorage.removeItem(ACCESS_STORAGE_KEY);
  } catch {}
}

/** User headers for the signed standalone links delivered by WhatsApp. */
export function userAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const accessToken = getStandaloneAccessToken();
  if (accessToken) headers["X-Brutal-Access-Token"] = accessToken;
  return headers;
}

export async function fetchStandaloneAccessContext(
  expectedPurpose: AccessPurpose,
): Promise<StandaloneAccessContext> {
  const token = captureStandaloneAccessToken();
  if (!token) throw new Error("missing_access");

  const response = await fetch(`${API_BASE}/access/context?purpose=${expectedPurpose}`, {
    headers: userAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearStandaloneAccessToken();
    }
    throw new Error(response.status === 403 ? "wrong_purpose" : "invalid_access");
  }

  return response.json();
}
