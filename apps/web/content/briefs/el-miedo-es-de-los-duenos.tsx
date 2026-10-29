import { BriefHead, Screen, VoiceScreen, Voices, Sources } from '@/components/brief';

export const meta = {
  slug: 'el-miedo-es-de-los-duenos',
  kind: 'Nota',
  title: 'El miedo es de los dueños.',
  dek: 'Se da por hecho que los más jóvenes son los que más temen que una máquina les saque el trabajo. Fuimos a mirarlo de otra manera y vimos algo más incómodo: para tener miedo de perder un puesto, primero hay que sentirlo propio.',
  date: 'Noviembre 2026',
  dateLabel: 'Buenos Aires, noviembre de 2026',
  minutes: 6,
  topics: 'Trabajo · Inteligencia artificial · Veinte años',
  draft: 'Piloto interno · borrador para leer · no publicar',
};

export default function Brief() {
  return (
    <article>
      <BriefHead kicker={meta.topics} title={<>El miedo es<br />de los dueños.</>} dek={`${meta.dek} Y eso, en este grupo, casi no apareció.`} date={meta.dateLabel} minutes={meta.minutes} draft={meta.draft} />

      <div className="col prose">
        <p className="open">La voz que pregunta es de máquina, grave, sin acento, y sale del parlante del teléfono después de una pantalla negra. "Decí qué parte de tu laburo ya podría hacer una inteligencia artificial, y por qué todavía no te reemplazaron." Da quince segundos. Una chica que eligió llamarse Miricleta contesta antes de que la pregunta termine de sonar: "Nada. Soy reemplazable." Tarda un segundo. No hay ironía ni queja. Es el tono con el que uno dice la dirección de su casa.</p>

        <p>Hay una idea que todos manejamos en automático: que la inteligencia artificial es, antes que nada, una amenaza para los que recién empiezan, y que los de veinte años viven este año con una ansiedad que los mayores apenas imaginamos. Suena razonable. Son los que tienen toda la vida laboral por delante y los primeros en la fila de lo que se automatiza. Nosotros también lo creíamos. Por eso, en vez de preguntárselo, les armamos un juego.</p>

        <p>Un juego de cuatro minutos que se abre desde un link de WhatsApp: diecinueve pantallas con dilemas cortos y dos o tres botones, una voz que de vez en cuando pregunta algo y espera, y en el medio unas manos de cartas donde se apuestan tickets que al final se cambian por plata. Nadie sabe de qué se trata, porque no se trata de nada: hay un préstamo que un amigo no devuelve, un cargo en el Estado por un contacto del padre, un famoso para deportar. Entre esas pantallas, cuatro hablaban de trabajo sin decir la palabra. Cada toque queda guardado con los segundos que tardó. Una mañana de fines de octubre lo jugaron quince personas de veintipico que nos llegaron por amigos de amigos. Es un grupo chico, y lo que sigue hay que leerlo así: como algo que vimos, no como algo que medimos.</p>

        <Screen n={8} total={19} question="Te contratan para armar una IA que hace el laburo de veinte personas de una oficina. Ganás muy bien, pero ellos se quedan sin laburo. ¿Aceptás?" options={['Acepto', 'No acepto']} chosen={0} caption="Dos de cada tres tocaron el botón de arriba. Los que dijeron que no tardaron lo mismo: unos siete segundos." />

        <p>Dos de cada tres la arman. Eso solo no dice mucho; lo que dice algo es el reloj. Aceptar y rechazar tardaron igual, lo que lleva leer la pantalla. La pantalla siguiente metía a un familiar entre los veinte y preguntaba si cambiaban: la respuesta llegó más rápido todavía, y para la mayoría de los que habían aceptado, no cambió. Nadie estaba peleando con nada. No es que la plata le haya ganado a la empatía: es que el puesto de un desconocido no pesaba, y el de un primo pesaba poco.</p>

        <p>Después vino la voz, con la pregunta del principio: qué parte de tu trabajo ya podría hacer una inteligencia artificial, y por qué todavía no te reemplazaron. Las diez respuestas que llegaron enteras se parecen de un modo que no esperábamos.</p>

        <VoiceScreen n={16} total={19} question="Decí qué parte de tu laburo ya podría hacer una IA, y por qué todavía no te reemplazaron." caption="La voz hace la pregunta en voz alta y da quince segundos. Se contesta hablando o escribiendo." />

        <Voices items={[
          { quote: 'Nada. Soy reemplazable.', who: 'Miricleta' },
          { quote: 'No me reemplazaron porque no se dieron cuenta, creo. Pero ya hay avatares, influencers y demás.', who: 'Arto' },
          { quote: 'Casi todo lo podría hacer, y todavía no me rajaron. Podría ser un chat.', who: 'Alf' },
          { quote: 'Es un trabajo muy de personas.', who: 'Marcos B' },
          { quote: 'Mi trabajo se basa en la confianza y en estar presente: la comunicación del día a día, la confianza que uno transmite, sobre todo cuando estás vendiendo.', who: 'Kulorex' },
        ]} />

        <p>Unos siguen en su puesto por descuido ajeno: no se dieron cuenta, no me rajaron todavía. Otros lo defienden, pero con lo que el trabajo es: personas, confianza, logística. Lo que no apareció en ninguna de las diez es la frase que cualquiera de nosotros habría dicho casi con fastidio: <em>porque soy bueno en esto</em>. Y tampoco apareció lo que habíamos ido a buscar. No hay miedo en esas voces. Hay algo más parecido a un parte meteorológico.</p>

        <blockquote>Para tener miedo de perder algo, primero hay que sentir que es de uno.</blockquote>

        <p>Esa es la idea que nos quedó, y conviene decirla con cuidado porque es fácil exagerarla. No es que los de veinte no sientan nada por su trabajo; están en sus primeros empleos y seguramente les importan, se nota en la precisión con que hablan de lo que hacen. Es que lo que sienten no pasa por el puesto. El puesto, la silla, el lugar en el organigrama, no parece ser de ellos ni de nadie, y por eso no lo defienden cuando es de otro ni cuando es el propio. Llegaron a un país donde, según se dijo hace un mes en el Coloquio de IDEA, casi seis de cada diez trabajadores menores de treinta están en negro, y donde la ley laboral de este año reemplazó la vieja idea de la indemnización, el precio por sacarte algo tuyo, por un fondo que el empleador deposita mes a mes, como quien paga el alquiler por adelantado. Nadie les mintió: el contrato dice que el lugar no es de ellos. Lo ocupan como se ocupa un puesto de feria, que se arma a las siete, se desarma a las dos y deja la vereda libre. El feriante cuida la mercadería y atiende bien. Lo que no hace es pelear por la vereda.</p>

        <p>Si esto es así, aunque sea en parte, el miedo a la inteligencia artificial que este año ocupa diarios, directorios y sobremesas es, sobre todo, un miedo de propietarios. De los que tienen un escritorio con una foto, treinta años de antigüedad o la idea de que su puesto existe. Los que más tendrían que temer, según la cuenta automática, son los que menos parecen hacerlo, y no por valentía ni por ignorancia: porque no se puede extrañar una casa que nunca estuvo en la cuadra.</p>

        <h2>Lo que sí tiene dueño</h2>
        <p>El mismo juego muestra dónde fue a parar la pertenencia. Una pantalla preguntaba qué parte del sueldo resignarían por hacer exactamente el mismo trabajo desde su casa, en jogging. El promedio fue cerca de una sexta parte; alguno, más de un tercio. Otra ponía la escena del compañero que labura menos pero va a todos los after y el jefe lo adora: la mayoría reconoció que sube él, y más de la mitad de esos dijo que igual no piensa empezar a ir. Conocen la regla y eligen no jugarla. Lo que defienden con plata propia es el tiempo y la distancia. Lo que no están dispuestos a comprar es la silla.</p>

        <p>Para el que tiene gente de veinte en su empresa esto cambia dos cosas que suelen darse por sentadas. La primera: la resistencia a automatizar, si aparece, probablemente no venga de ellos. Los de veinte arman la máquina y se declaran reemplazables en la misma partida; se van a adaptar, o se van a ir, sin hacer ruido. La segunda: los programas de pertenencia, los valores en la pared y la carrera a cinco años le hablan al dueño de un escritorio. Si lo que esta gente valora es el tiempo, un día más en casa retiene más que un plan de carrera, y es más barato.</p>

        <h2>Por qué le creemos al juego</h2>
        <p>Una última pantalla, para explicar por qué confiamos más en cuatro minutos de juego que en una encuesta. En el medio hay una pregunta de encuesta: no llegás a fin de mes, ordená qué cortás primero. Casi todos pusieron las apuestas al tope, como corresponde. Cincuenta segundos después, el juego puso sobre la mesa los tickets que llevaban ganados y preguntó: ¿doble o nada? Había un botón para plantarse. No lo tocó nadie. No es que mientan: es que hay dos personas en cada uno, la que contesta y la que hace, y las encuestas solo hablan con la primera. Todo lo de arriba lo dijo la segunda.</p>

        <p>Puede que estemos viendo juventud y no generación; a los veintidós todos fuimos inquilinos del primer trabajo. Puede que "soy reemplazable" sea realismo y no desapego, y que Miricleta sepa algo sobre lo que una máquina ya hace con una planilla que los de cuarenta preferimos no mirar. Las dos cosas pueden ser ciertas a la vez, y ninguna cambia lo que vimos: que fuimos a buscar miedo donde todos lo ubican y encontramos, en su lugar, a alguien que se encoge de hombros en un segundo.</p>

        <p className="end">Tal vez la pregunta no sea cómo preparar a los jóvenes para la inteligencia artificial, sino cómo preparar a los dueños.</p>
      </div>

      <Sources items={[
        <>El juego: "Mentime que me gusta", 19 pantallas, 29 de octubre de 2026, por link de grupo. 36 personas lo abrieron, 15 lo terminaron, en una mediana de cuatro minutos y medio. Entraron con apodo; no se pidió edad ni lugar. Las respuestas habladas se transcribieron y se corrigieron para que se lean como se dijeron, sin cambiar lo que dicen. Es un piloto.</>,
        <>Informalidad en menores de 30: 58,4%, Invecq sobre INDEC, presentado en el 62º Coloquio de IDEA, Mar del Plata, 2 de octubre de 2026.</>,
        <>Ley 27.802 de Modernización Laboral, promulgada el 6 de marzo de 2026: Fondos de Asistencia Laboral con aportes mensuales del empleador; excluye a los prestadores de plataformas.</>,
      ]} />
    </article>
  );
}
