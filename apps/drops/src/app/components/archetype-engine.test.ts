import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveScoring, computeDimensions } from './archetype-engine.ts';

test('las reglas por etiqueta encuentran la carta aunque se haya corrido o apagado otra', () => {
  const scoring = {
    choiceScoring: [
      { questionIndex: -1, questionLabel: 'after', optionScores: [{ cinismo: 1 }, { postureo: 1 }] },
      { questionIndex: 0, optionScores: [{ caos: 1 }, { caos: 2 }] },
      { questionIndex: -1, questionLabel: 'apagada', optionScores: [{ caos: 9 }] },
    ],
    sliderScoring: [{ questionIndex: -1, questionLabel: 'dias', ranges: [{ min: 0, max: 7, scores: { caos: 2 } }] }],
  };
  // La carta "doble" se apagó: "after" quedó en el lugar 2 y "dias" en el 1.
  const r = resolveScoring(scoring, ['prestamo', 'dias', 'after']);
  assert.deepEqual(r.choiceScoring!.map((x) => x.questionIndex), [2, 0]);
  assert.equal(r.sliderScoring![0].questionIndex, 1);
  const dims = computeDimensions({ 0: { type: 'choice', selectedIndex: 0 }, 1: { type: 'slider', value: 3 }, 2: { type: 'choice', selectedIndex: 0 } }, r, 0);
  assert.deepEqual(dims, { caos: 3, cinismo: 1 });
});
