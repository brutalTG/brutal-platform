/** Browser-native tactile feedback for the standalone webapp. */

function vibrate(pattern: number | number[]): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export function getHapticDebugInfo(): Record<string, string> {
  return { "Vibration API": typeof navigator !== "undefined" && typeof navigator.vibrate === "function" ? "YES" : "no" };
}

export function runBridgeTest(): string {
  return vibrate(20) ? "Browser vibration OK" : "Vibration not available";
}

/** Kept as a harmless compatibility shim for the internal debug screen. */
export function forceSDKVersion(): boolean { return false; }

export function hapticSelection() { vibrate(8); }
export function hapticLight() { vibrate(12); }
export function hapticMedium() { vibrate(20); }
export function hapticHeavy() { vibrate(35); }
export function hapticRigid() { vibrate([12, 18, 12]); }
export function hapticSuccess() { vibrate([18, 35, 35]); }
export function hapticError() { vibrate([35, 25, 35]); }
export function hapticWarning() { vibrate([25, 30, 15]); }
