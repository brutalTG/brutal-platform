// Apodo ya puesto: en el Drop 001 el 31% se fue en la pantalla del apodo. Entrar es un toque; cambiarlo es opcional.
const NICK_A = ["Lobo", "Gato", "Tano", "Rayo", "Faro", "Mate", "Puma", "Zorro", "Nube", "Toro", "Corcho", "Piraña"];
const NICK_B = ["Manso", "Turbio", "Sereno", "Cruel", "Tibio", "Feroz", "Dudoso", "Leal", "Frío", "Loco"];
export function randomNickname(rand: () => number = Math.random) {
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  return `${pick(NICK_A)} ${pick(NICK_B)} ${10 + Math.floor(rand() * 90)}`;
}
