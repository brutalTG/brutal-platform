// ============================================================
// El color del duotono también pinta las barras del navegador.
// Cada pantalla pone su fondo en `--dynamic-bg` sobre <body>; acá se copia ese color
// al fondo de la página (lo que se ve arriba y abajo, y al estirar) y a theme-color
// (la barra de Chrome en Android y el tinte de Safari en iPhone).
// ============================================================

function meta(): HTMLMetaElement {
  let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!m) {
    m = document.createElement("meta");
    m.name = "theme-color";
    document.head.appendChild(m);
  }
  return m;
}

let last = "";
function sync() {
  const bg = getComputedStyle(document.body).getPropertyValue("--dynamic-bg").trim() || "#000000";
  if (bg === last) return;
  last = bg;
  document.documentElement.style.backgroundColor = bg;
  document.body.style.backgroundColor = bg;
  meta().content = bg;
}

/** Arranca una vez: sigue los cambios de `--dynamic-bg` durante toda la partida. */
export function followDuotoneChrome() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  sync();
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["style"] });
}
