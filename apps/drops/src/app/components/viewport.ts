/** Reset the standalone browser viewport after an input or keyboard closes. */
export function resetViewport() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  setTimeout(() => {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, 100);
  setTimeout(() => window.scrollTo(0, 0), 400);
}
