import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pitch, rms, thresholdFrom, Vad } from './signal.ts';

test('detecta el tono de una onda de 150 Hz', () => {
  const sr = 16000, buf = new Float32Array(1024);
  for (let i = 0; i < buf.length; i++) buf[i] = 0.3 * Math.sin((2 * Math.PI * 150 * i) / sr);
  const f = pitch(buf, sr)!;
  assert.ok(Math.abs(f - 150) < 6, `tono ${f}`);
  assert.equal(pitch(new Float32Array(1024), sr), null);
  assert.ok(rms(buf) > 0.2);
});

test('el detector de habla marca arranque, pausas y final', () => {
  const vad = new Vad(0.05);
  const feed = (from: number, to: number, level: number) => { let s = ''; for (let t = from; t < to; t += 20) s = vad.feed(level, t); return s; };
  assert.equal(feed(0, 800, 0.01), 'idle');
  assert.equal(feed(800, 1600, 0.2), 'speaking');
  assert.equal(vad.onsetAt, 800);
  feed(1600, 2100, 0.01); // pausa de 500 ms
  feed(2100, 2600, 0.2);
  assert.equal(vad.pauses, 1);
  assert.equal(feed(2600, 4200, 0.01), 'ended');
  assert.ok(vad.speechMs() > 1700);
});

test('el umbral se adapta al ruido sin pasarse', () => {
  assert.equal(thresholdFrom(0), 0.015);
  assert.equal(thresholdFrom(1), 0.12);
});
