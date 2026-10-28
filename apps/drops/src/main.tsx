
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { followDuotoneChrome } from "./app/components/chrome-color";

  followDuotoneChrome();

  createRoot(document.getElementById("root")!).render(<App />);
  