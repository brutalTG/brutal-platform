// ============================================================
// ECONOMÍA DEL JUGADOR — qué premios se muestran
// ============================================================
// Por ahora BRUTAL paga solo con Golden Tickets: la plata confundía ("no entendí cómo ganás más o menos")
// y obligaba a explicar qué es BRUTAL antes de jugar. Para volver a mostrar USD alcanza con poner true.
// Esto solo cambia lo que se ve; lo que se acredita sale de cada carta (reward_cash_usd en la base).
// ============================================================

export const CASH_ENABLED = false;

/** ¿Se muestra plata a este jugador? Nunca a menores. */
export const showsCash = (isMinor: boolean) => CASH_ENABLED && !isMinor;

/** Una línea que explica para qué sirven los tickets. Se usa en la entrada y al final. */
export const TICKETS_LINE = "Cada respuesta suma Golden Tickets. Cada dos semanas se cierra el ranking.";
