
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { followDuotoneChrome } from "./app/components/chrome-color";
  import { inject } from "@vercel/analytics";

  followDuotoneChrome();
  // Visitas de Vercel (si está activado en el proyecto): país, tipo de teléfono, de qué app vienen.
  inject();

  createRoot(document.getElementById("root")!).render(<App />);
  