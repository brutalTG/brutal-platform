import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, useRouteError } from "react-router";
import { Analytics } from "@vercel/analytics/react";

// Lazy-load each route so a module failure in one doesn't crash the others
const SurveyApp = lazy(() => import("./components/SurveyApp"));
const OnboardingApp = lazy(() => import("./components/onboarding/OnboardingApp"));
const LinkRedeem = lazy(() => import("./components/LinkRedeem"));
const GroupJoin = lazy(() => import("./components/GroupJoin"));

function RouteLoading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
      }}
    >
      <span
        style={{
          fontFamily: "Silkscreen, monospace",
          fontSize: 11,
          color: "#444",
          letterSpacing: 2,
        }}
      >
        Cargando...
      </span>
    </div>
  );
}

function SurveyRoute() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <SurveyApp />
    </Suspense>
  );
}

function OnboardingRoute() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <OnboardingApp />
    </Suspense>
  );
}

// Si algo se rompe en pantalla: en vez de la página blanca de error, un aviso con el detalle (para la captura)
// y un botón que vuelve a entrar. Lo ya contestado queda guardado en el servidor.
function CrashScreen() {
  const err = useRouteError() as { message?: string; stack?: string } | undefined;
  const detail = `${err?.message ?? String(err ?? "")}`.slice(0, 300);
  if (typeof console !== "undefined") console.error("[BRUTAL] Pantalla rota:", err);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 380, width: "100%", border: "1px solid rgba(255,255,255,.15)", borderRadius: 28, padding: 28 }}>
        <p style={{ fontFamily: "Silkscreen, monospace", fontSize: 22, marginBottom: 16 }}>ALGO SE ROMPIÓ</p>
        <p style={{ fontFamily: "Fira Code, monospace", fontSize: 13, opacity: .7, lineHeight: 1.5, marginBottom: 20 }}>Lo que ya contestaste quedó guardado. Tocá para volver a entrar.</p>
        <button onClick={() => window.location.reload()} style={{ width: "100%", height: 56, borderRadius: 999, background: "#E8FF00", color: "#000", fontWeight: 800, border: 0 }}>SEGUIR</button>
        <p style={{ fontFamily: "Fira Code, monospace", fontSize: 10, opacity: .4, marginTop: 18, wordBreak: "break-word" }}>{detail} · {navigator.userAgent.slice(0, 120)}</p>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  { path: "/a/:code", Component: () => <Suspense fallback={<RouteLoading />}><LinkRedeem /></Suspense>, errorElement: <CrashScreen /> },
  { path: "/j/:code", Component: () => <Suspense fallback={<RouteLoading />}><GroupJoin /></Suspense>, errorElement: <CrashScreen /> },
  { path: "/entrar", Component: OnboardingRoute, errorElement: <CrashScreen /> },
  { path: "/*", Component: SurveyRoute, errorElement: <CrashScreen /> },
]);

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Analytics />
    </>
  );
}
