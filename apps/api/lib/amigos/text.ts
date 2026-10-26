// Todo lo que dice el bot. Un solo registro: alguien que lleva años mirando grupos de amigos y ya no espera nada.
import type { Question } from './types.ts';

export const GAME = 'AMIGOS DE MIERDA';

export const T = {
  intro: () =>
    `${GAME}. Un juego para gente que no quiere tanto a sus amigos.\n\n` +
    `Una pregunta por día a tu grupo. Cada uno contesta y apuesta qué contestó cada amigo. A la noche, quién te conoce y quién no tiene idea.\n\n` +
    `Tus respuestas y audios se guardan para el juego y para investigación anónima de BRUTAL. SALIR te saca cuando quieras; BORRAME borra todo.\n\n` +
    `¿Cómo se llama tu grupo?`,
  askMe: (group: string) => `¿Y a vos cómo te dicen en ${group}?`,
  badName: () => 'Eso no es un nombre. Probá de nuevo, cortito.',
  pick: (lines: string[], own = true) =>
    `Elegí con qué los arrancás:\n\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n\n')}\n\n` +
    `Respondé 1, 2 o 3.${own ? ' O escribí tu propio dilema.' : ''} IDEAS para otras.`,
  authorTurn: (lines: string[], openHour: number) =>
    `Hoy preguntás vos. Sale a las ${openHour} con tu nombre.\n\n` +
    `Mandame un dilema con dos opciones envenenadas, o elegí uno:\n\n${lines.map((l, i) => `${i + 1}. ${l}`).join('\n\n')}\n\n` +
    `Respondé 1, 2 o 3, escribí el tuyo, o IDEAS para otras.`,
  askOptionA: () => 'Bien. ¿Opción A? Cortita, hasta 40 letras.',
  askOptionB: () => '¿Y la opción B?',
  tooLong: (max: number) => `Muy largo. Hasta ${max} letras.`,
  askVictim: (names: string[]) =>
    `¿Querés marcar una víctima? Todas las apuestas van a esa persona y valen doble.\n\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nRespondé el número, o NO.`,
  authorReady: (openHour: number) => `Listo. Sale a las ${openHour} con tu nombre. Ya podés ir sufriendo.`,
  authorMissed: (name: string) => `Se te pasó la hora, ${name}. Hoy pregunta BRUTAL, que nunca se olvida.`,

  askRoster: () => '¿Quiénes juegan? Escribí los nombres separados por coma, como les dicen en el grupo.',
  rosterEmpty: () => 'Necesito al menos un nombre. Ej: Lu, Juan, Mati',
  question: (q: Question, by: string, victim: string | null) =>
    `${by}\n\n${q.prompt}${q.detail ? `\n${q.detail}` : ''}\n\nA · ${q.option_a}\nB · ${q.option_b}` +
    (victim ? `\n\nHoy la víctima es ${victim}: todas las apuestas van a esa persona.` : '') +
    `\n\nRespondé A o B.`,
  badChoice: (q: Question) => `A o B. A es «${q.option_a}», B es «${q.option_b}».`,
  betsIntro: () => 'Ahora apostá por los demás. Cada acierto suma.',
  bet: (name: string, q: Question) => `¿Qué dijo ${name}?\n\nA · ${q.option_a}\nB · ${q.option_b}`,
  voice: (name: string, nudge: string, revealHour: number) =>
    `Tu objetivo de hoy es ${name}. Mandale un audio de 10 segundos: ${nudge}\n\nLo escucha a las ${revealHour}. Si le pega, suma. Si no querés, SALTEAR.`,
  voiceSaved: (name: string, revealHour: number) => `Guardado. ${name} lo escucha a las ${revealHour}.`,
  voiceWritten: (name: string) => `Se lo mando así, escrito. ${name} va a notar que no te animaste al audio.`,
  voiceSkipped: () => 'Salteado. Cobarde, pero salteado.',
  voiceOutOfTurn: () => 'Me llegó un audio pero no te estaba pidiendo uno. Lo tiré a la basura con cariño.',
  rateAudioIntro: (from: string) => `${from} te mandó esto sobre vos:`,
  rateWritten: (from: string, text: string) => `${from} te escribió esto sobre vos:\n\n«${text}»`,
  rateAsk: () => '¿Te leyó? SI o NO.',
  rateBad: () => 'SI o NO. No es tan difícil.',
  rated: (read: boolean) => (read ? 'Anotado. Le diste 10 puntos por conocerte.' : 'Anotado. No tiene idea, y ahora lo sabe.'),
  ratedNotice: (to: string, read: boolean) => (read ? `${to} escuchó tu audio: dice que la/lo leíste. +10.` : `${to} escuchó tu audio: dice que no tenés idea.`),

  share: (founder: string) => `Ya apostaste lo que contesta cada uno. Ahora pegá esto en el grupo, ${founder}:`,
  shareText: (founder: string, link: string) => `Ya aposté lo que contesta cada uno de ustedes. Contestá acá y vemos quién me conoce: ${link}`,
  shareAfter: (revealHour: number) => `Cuando contesten te voy avisando. A las ${revealHour} sale quién conoce a quién. Mañana arranca el día 2.`,

  welcome: (founder: string, group: string) =>
    `${founder} te metió en ${GAME} (${group}). Una pregunta por día; apostás qué contestó cada uno.\n\n` +
    `Tus respuestas y audios se guardan para el juego y para investigación anónima de BRUTAL. SALIR te saca cuando quieras.`,
  whoAreYou: (founder: string, names: string[]) =>
    `${founder} dice que juegan:\n\n${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n¿Cuál sos vos? Respondé el número, o escribí tu nombre si no estás.`,
  askJoinName: () => '¿Cómo te dicen en el grupo?',
  nameTaken: (name: string) => `Ya hay un ${name} en el grupo. Poné otro.`,
  groupFull: () => 'El grupo está lleno: doce es el máximo de gente que se puede odiar a la vez.',
  noGroup: () => 'No encuentro ese grupo. Pedile el link de nuevo a quien te invitó.',
  groupOver: (group: string) => `${group} ya terminó su temporada. Que alguien escriba OTRA y vuelven a empezar.`,
  alreadyIn: (group: string) => `Ya estás en ${group}.`,
  instant: (founder: string, guess: string, mine: string) =>
    guess === mine ? `${founder} apostó que decías «${guess}». Dijiste «${mine}». Te conoce. Qué miedo.`
      : `${founder} apostó que decías «${guess}». Dijiste «${mine}». No te conoce.`,
  instantNoBet: (founder: string) => `${founder} no apostó por vos porque no te tenía en la lista. Anotado para mañana.`,
  tooLate: () => 'Esa ya se reveló. Llegaste tarde, como siempre.',

  reminder: (done: number) => `Faltás vos. ${done} ya contestaron.`,
  revealCaption: (group: string, day: number, link: string) => `${group} · día ${day}. ¿Vos qué hubieras dicho? ${link}`,
  revealPersonal: (points: number, pos: number, n: number, total: number) =>
    `Hoy sumaste ${points}. Vas ${pos}º de ${n} con ${total}.${pos === n && n > 1 ? ' Último. Hay que decirlo.' : ''}`,
  revealShare: () => 'Pegalo en el grupo. Que se sepa.',
  dormant: (group: string) => `Hace tres días que no contestás en ${group}. Te pausé. Escribí VUELVO cuando quieras.`,
  seasonOver: (winner: string) => `Temporada terminada. La corona es para ${winner}. El resto, a reflexionar.`,
  seasonAgain: () => 'Escribí OTRA para arrancar otra temporada con el mismo grupo.',
  seasonRestarted: (group: string, turnHour: number) => `Otra temporada de ${group}. Mañana a las ${turnHour} alguien pregunta.`,
  notFounder: () => 'Eso lo decide quien armó el grupo.',

  askAge: () => 'Última y te dejo en paz: ¿cuántos años tenés?',
  badAge: () => 'Un número. Tu edad, no la que aparentás.',
  minor: () => 'Esto es para mayores de 18. Te saqué del juego y no te vamos a escribir más. Volvé cuando seas un adulto decepcionante.',
  ageThanks: () => 'Gracias. A la noche sale quién conoce a quién.',

  idle: (openHour: number) => `Hoy no hay nada para vos. La próxima sale a las ${openHour}. AYUDA si te perdiste.`,
  help: () =>
    `${GAME}, en tres líneas:\n` +
    `1. Una pregunta por día. Contestás A o B.\n` +
    `2. Apostás qué contestó cada amigo. Cada acierto suma.\n` +
    `3. A la noche sale quién conoce a quién. Cada día pregunta uno distinto.\n\n` +
    `TABLA: cómo va el grupo. PAUSA: hoy no. SALIR: chau. BORRAME: borra todo.`,
  paused: () => 'Hoy no te escribo más. Mañana volvés solo.',
  back: () => 'Volviste. Nadie te extrañó, pero bienvenido.',
  optOut: () => 'Listo, no te escribo más. Si un día extrañás que te traten mal, escribí cualquier cosa.',
  erased: () => 'Borré tus respuestas, tus apuestas y tus audios. Y ya no te escribo. Como si nunca te hubieran conocido.',
  noTable: () => 'Todavía no estás en ningún grupo. Escribí NUEVO para armar uno.',
};

// Lo que le dice cada uno a su objetivo: cambia cada día para que no sea rutina.
export const NUDGES = [
  'decile qué contestó y por qué.',
  'decile si lo conocés de verdad o si lo inventás.',
  'decile qué le pesa más en esta pregunta.',
  'decile qué haría si nadie lo estuviera mirando.',
  'decile qué contestaría hace cinco años.',
  'decile qué te diría a vos en la cara.',
  'decile si te lo contaría a vos.',
];
