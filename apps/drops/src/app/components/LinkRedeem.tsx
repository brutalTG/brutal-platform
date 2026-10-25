import { useEffect, useState } from "react";
import { API_BASE } from "./api-base";
import { AccessNotice } from "./AccessNotice";

/**
 * Link personal de WhatsApp: /a/<código>.
 * Lo canjea por el token de acceso y sigue al onboarding, al Drop o al perfil, como hacía el servidor del sandbox.
 */
export default function LinkRedeem() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const code = window.location.pathname.split("/").filter(Boolean)[1] ?? "";
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        if (!res.ok) throw new Error(String(res.status));
        const r = (await res.json()) as { token: string; destination: "onboarding" | "drop" | "profile" };
        const q = `access=${encodeURIComponent(r.token)}`;
        window.location.replace(r.destination === "onboarding" ? `/entrar?${q}` : r.destination === "profile" ? `/?${q}&screen=profile` : `/?${q}`);
      } catch {
        setFailed(true);
      }
    })();
  }, []);
  if (failed) return <AccessNotice purpose="drop" invalid />;
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
      <span style={{ fontFamily: "Silkscreen, monospace", fontSize: 11, color: "#444", letterSpacing: 2 }}>Entrando...</span>
    </div>
  );
}
