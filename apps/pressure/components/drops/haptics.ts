// Las mismas funciones que Drops (haptics.ts), pero con la vibración del navegador:
// acá no estamos dentro de Telegram.
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* sin vibración */ } };
export const hapticLight = () => buzz(10);
export const hapticMedium = () => buzz(18);
export const hapticHeavy = () => buzz(30);
export const hapticRigid = () => buzz(14);
export const hapticSelection = () => buzz(6);
export const hapticWarning = () => buzz([20, 40, 20]);
export const hapticSuccess = () => buzz([15, 30, 15]);
export const hapticError = () => buzz([60, 30, 60]);
