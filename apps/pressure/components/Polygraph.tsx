'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// El polígrafo de la entrada: foto real de la máquina, papel que corre y tres agujas dibujadas encima.
// La voz del jugador mueve la aguja de respiración; la sospecha de la máquina sacude la de sudor (EDA).

export type PolygraphHandle = {
  jolt: (amount: number) => void; // sacudón: sospecha
  setLevel: (level: number) => void; // volumen de la voz, 0..1
  setFrozen: (frozen: boolean) => void; // el papel se detiene (acusación)
  setSpeed: (factor: number) => void;
};

const IW = 1438, IH = 2576;
const PAPER = { x0: 185, x1: 1225, y0: 700, y1: 1548 };
const BAND = { y0: 790, y1: 1170 };
const PAPER_CX = 705;

type Pen = {
  label: string; px: number; py: number; tx: number; ty: number; amp: number; ink: string; w: number;
  L: number; base: number; a: number; th: number; vel: number; pts: { x: number; y: number }[]; tip: { x: number; y: number };
};

function noise() {
  const n = 512, v = Float32Array.from({ length: n }, () => Math.random() * 2 - 1);
  return (x: number) => {
    const i = Math.floor(x), f = x - i, a = v[((i % n) + n) % n], b = v[(((i + 1) % n) + n) % n], u = (1 - Math.cos(f * Math.PI)) / 2;
    return a + (b - a) * u;
  };
}

export const Polygraph = forwardRef<PolygraphHandle, { panelHeight: number; onTap?: () => void; label?: string }>(
  function Polygraph({ panelHeight, onTap, label = 'Polígrafo en funcionamiento' }, ref) {
    const wrap = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const api = useRef({ jolt: (_: number) => {}, relayout: () => {}, level: 0, frozen: false, speed: 1 });
    const panelH = useRef(panelHeight);
    panelH.current = panelHeight;

    useImperativeHandle(ref, () => ({
      jolt: (a) => api.current.jolt(a),
      setLevel: (l) => { api.current.level = Math.max(0, Math.min(1, l)); },
      setFrozen: (f) => { api.current.frozen = f; },
      setSpeed: (s) => { api.current.speed = s; },
    }), []);

    useEffect(() => {
      const cv = canvas.current!, box = wrap.current!, ctx = cv.getContext('2d')!;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const SPEED = reduce ? 22 : 52;
      let W = 0, H = 0, DPR = 1, S = 1, OX = 0;
      let img: HTMLImageElement | null = null, K = 1;
      let tex: (HTMLCanvasElement & { lh?: number; lw?: number }) | null = null;
      let overlays: { c: HTMLCanvasElement; x: number; y: number; w: number; h: number }[] = [];
      let offset = 0, t = 0, stress = 0, raf = 0, last = performance.now(), running = true;
      const pens: Pen[] = [
        { label: 'RESP', px: 488, py: 345, tx: 655, ty: 1005, amp: 115, ink: 'rgba(30,72,170,.9)', w: 3.2 },
        { label: 'CARDIO', px: 720, py: 340, tx: 712, ty: 1065, amp: 85, ink: 'rgba(18,112,72,.9)', w: 3.0 },
        { label: 'EDA', px: 945, py: 345, tx: 770, ty: 985, amp: 150, ink: 'rgba(190,34,26,.92)', w: 3.8 },
      ].map((p) => {
        const L = Math.hypot(p.tx - p.px, p.ty - p.py), base = Math.atan2(p.tx - p.px, p.ty - p.py);
        return { ...p, L, base, a: p.amp / L, th: base, vel: 0, pts: [], tip: { x: p.tx, y: p.ty } };
      });

      const off = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
      function buildLayers() {
        K = img!.naturalWidth / IW;
        const bw = PAPER.x1 - PAPER.x0, bh = BAND.y1 - BAND.y0;
        tex = off(bw * K, bh * 2 * K); const g = tex.getContext('2d')!;
        g.drawImage(img!, PAPER.x0 * K, BAND.y0 * K, bw * K, bh * K, 0, 0, bw * K, bh * K);
        g.save(); g.translate(0, bh * 2 * K); g.scale(1, -1); g.drawImage(img!, PAPER.x0 * K, BAND.y0 * K, bw * K, bh * K, 0, 0, bw * K, bh * K); g.restore();
        tex.lh = bh * 2; tex.lw = bw;
        const piece = (x: number, y: number, w: number, h: number, fadeTop: number, fadeBot: number) => {
          const c = off(w * K, h * K), q = c.getContext('2d')!;
          q.drawImage(img!, x * K, y * K, w * K, h * K, 0, 0, w * K, h * K);
          q.globalCompositeOperation = 'destination-in';
          const gr = q.createLinearGradient(0, 0, 0, h * K);
          gr.addColorStop(0, fadeTop ? 'rgba(0,0,0,0)' : '#000');
          if (fadeTop) gr.addColorStop(Math.min(0.99, fadeTop / h), '#000');
          if (fadeBot) gr.addColorStop(Math.max(0.01, 1 - fadeBot / h), '#000');
          gr.addColorStop(1, fadeBot ? 'rgba(0,0,0,0)' : '#000');
          q.fillStyle = gr; q.fillRect(0, 0, w * K, h * K);
          return { c, x, y, w, h };
        };
        overlays = [piece(110, 620, 1220, 200, 0, 46), piece(128, 1172, 156, 390, 22, 0), piece(1122, 1172, 166, 390, 22, 0), piece(128, 1500, 1170, 110, 34, 0)];
      }

      function layout() {
        DPR = Math.min(2, window.devicePixelRatio || 1);
        W = box.clientWidth; H = box.clientHeight;
        cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
        const cover = Math.max(W / IW, H / IH);
        // El polígrafo nunca pasa de 42% de la pantalla: el texto manda.
        const fit = Math.min(H - panelH.current - 6, H * 0.42) / 1585;
        S = Math.max(0.12, Math.min(cover, fit));
        OX = W / 2 - PAPER_CX * S;
        if (IW * S >= W) OX = Math.min(0, Math.max(W - IW * S, OX));
      }

      const nz = [noise(), noise(), noise(), noise(), noise(), noise()];
      const rnd = (a: number, b: number) => a + Math.random() * (b - a);
      const br = { ph: 0, per: 3.6, amp: 0.9, ampNow: 0.9 };
      const nextBreath = () => {
        const r = Math.random(), s = stress;
        if (r < 0.07 + s * 0.15) { br.per = rnd(2.5, 4); br.amp = 0.12; }
        else if (r < 0.13 + s * 0.1) { br.per = rnd(5, 6.5); br.amp = rnd(1.4, 1.7); }
        else { br.per = rnd(2.8, 4.6) * (1 - s * 0.4); br.amp = rnd(0.55, 1.05) * (1 + s * 0.3); }
      };
      const breathShape = (ph: number) => (ph < 0.38 ? -Math.cos((Math.PI * ph) / 0.38) : Math.cos((Math.PI * (ph - 0.38)) / 0.62));
      const hb = { ph: 0, dur: 0.85, amp: 1 };
      const beatShape = (f: number) => { const g = (m: number, w: number) => Math.exp(-(((f - m) / w) ** 2)); return 1.0 * g(0.08, 0.022) - 0.38 * g(0.14, 0.028) + 0.3 * g(0.34, 0.07) + 0.1 * g(0.5, 0.05); };
      let edaResp = 0, edaGoal = 0, nextEvent = rnd(3, 6), stressGoal = 0, voice = 0;
      function signals(dt: number) {
        const s = stress;
        voice += (api.current.level - voice) * Math.min(1, dt * 14);
        br.ph += dt / br.per; if (br.ph >= 1) { br.ph -= 1; nextBreath(); }
        br.ampNow += (br.amp - br.ampNow) * Math.min(1, dt * 2.5);
        const resp = breathShape(br.ph) * br.ampNow * (1 - voice * 0.6) + nz[0](t * 1.7) * 0.12 + nz[1](t * 9) * (0.03 + voice * 0.5);
        hb.ph += dt / hb.dur; if (hb.ph >= 1) { hb.ph -= 1; const rate = 1.15 + s * 0.9 + nz[2](t * 0.2) * 0.12; hb.dur = 1 / (rate * rnd(0.9, 1.1)); hb.amp = rnd(0.8, 1.15); }
        const cardio = beatShape(hb.ph) * hb.amp - 0.15 + nz[3](t * 0.35) * 0.45 + resp * 0.18 + nz[4](t * 12) * 0.025;
        nextEvent -= dt;
        if (nextEvent <= 0) { const m = rnd(0.2, 0.6); edaGoal += m; stressGoal = Math.max(stressGoal, m * 0.4); nextEvent = rnd(5, 12); }
        edaGoal *= Math.exp(-dt / rnd(6, 9));
        edaResp += (edaGoal - edaResp) * Math.min(1, dt * 3.2);
        stressGoal *= Math.exp(-dt / 3); stress = Math.max(stress, stressGoal);
        const eda = -0.45 + nz[5](t * 0.07) * 0.35 + edaResp + nz[4](t * 6 + 40) * 0.03;
        return [resp, cardio, eda];
      }
      api.current.jolt = (a: number) => {
        stress = Math.min(1, stress + a); edaGoal = Math.min(1.4, edaGoal + a * 1.1);
        pens.forEach((p) => (p.vel += (Math.random() - 0.5) * a * 1.4));
        try { navigator.vibrate?.(a > 0.6 ? [40, 30, 80] : [20]); } catch { /* sin vibración */ }
      };

      function tick(dt: number) {
        t += dt; stress = Math.max(0, stress - dt * 0.45);
        if (!api.current.frozen) offset += SPEED * api.current.speed * dt;
        const sig = signals(dt), sub = 3, h = dt / sub;
        pens.forEach((p, i) => {
          const target = p.base + p.a * sig[i];
          for (let k = 0; k < sub; k++) { const acc = 420 * (target - p.th) - 30 * p.vel; p.vel += acc * h; p.th += p.vel * h; }
          const th = p.th + (Math.random() - 0.5) * 0.0012;
          p.tip = { x: p.px + Math.sin(th) * p.L, y: p.py + Math.cos(th) * p.L };
          if (!api.current.frozen) p.pts.push({ x: p.tip.x, y: p.tip.y - offset });
          while (p.pts.length && p.pts[0].y + offset > PAPER.y1 + 10) p.pts.shift();
        });
      }

      function draw() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, W, H);
        if (!img || !tex) return;
        ctx.setTransform(DPR * S, 0, 0, DPR * S, DPR * OX, 0);
        ctx.drawImage(img, 0, 0, IW, IH);
        ctx.save();
        ctx.beginPath(); ctx.rect(PAPER.x0, PAPER.y0, PAPER.x1 - PAPER.x0, PAPER.y1 - PAPER.y0); ctx.clip();
        const o = offset % tex.lh!;
        for (let y = PAPER.y0 - tex.lh! + o; y < PAPER.y1; y += tex.lh!) ctx.drawImage(tex, PAPER.x0, y, tex.lw!, tex.lh!);
        ctx.globalCompositeOperation = 'multiply'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        pens.forEach((p) => {
          if (p.pts.length < 2) return;
          ctx.beginPath();
          p.pts.forEach((q, i) => { const y = q.y + offset; i ? ctx.lineTo(q.x, y) : ctx.moveTo(q.x, y); });
          ctx.strokeStyle = p.ink.replace(/[\d.]+\)$/, '.16)'); ctx.lineWidth = p.w * 2.8; ctx.stroke();
          ctx.strokeStyle = p.ink; ctx.lineWidth = p.w; ctx.stroke();
        });
        ctx.globalCompositeOperation = 'source-over';
        let gr = ctx.createLinearGradient(0, PAPER.y0, 0, PAPER.y0 + 170); gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.fillRect(PAPER.x0, PAPER.y0, PAPER.x1 - PAPER.x0, 170);
        gr = ctx.createLinearGradient(0, PAPER.y1 - 260, 0, PAPER.y1); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.32)');
        ctx.fillStyle = gr; ctx.fillRect(PAPER.x0, PAPER.y1 - 260, PAPER.x1 - PAPER.x0, 260);
        pens.forEach((p) => { ctx.strokeStyle = 'rgba(20,12,2,.30)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(p.px + 16, p.py + 14); ctx.lineTo(p.tip.x + 16, p.tip.y + 12); ctx.stroke(); });
        ctx.restore();
        overlays.forEach((v) => ctx.drawImage(v.c, v.x, v.y, v.w, v.h));
        pens.forEach((p) => {
          const { x: tx, y: ty } = p.tip, dx = tx - p.px, dy = ty - p.py, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(p.px + 3, p.py + 4); ctx.lineTo(tx - ux * 26 + 3, ty - uy * 26 + 4); ctx.stroke();
          ctx.strokeStyle = '#1b1c1e'; ctx.lineWidth = 6.5; ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(tx - ux * 26, ty - uy * 26); ctx.stroke();
          ctx.strokeStyle = 'rgba(205,200,190,.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.px + nx * 1.8, p.py + ny * 1.8); ctx.lineTo(tx - ux * 26 + nx * 1.8, ty - uy * 26 + ny * 1.8); ctx.stroke();
          ctx.fillStyle = '#202124'; ctx.beginPath(); ctx.moveTo(tx - ux * 34 + nx * 6, ty - uy * 34 + ny * 6); ctx.lineTo(tx - ux * 34 - nx * 6, ty - uy * 34 - ny * 6); ctx.lineTo(tx, ty); ctx.closePath(); ctx.fill();
          ctx.fillStyle = p.ink; ctx.beginPath(); ctx.arc(tx, ty, 3.4, 0, 7); ctx.fill();
          const r = 22, hg = ctx.createRadialGradient(p.px - 7, p.py - 8, 2, p.px, p.py, r);
          hg.addColorStop(0, '#a9a59c'); hg.addColorStop(0.55, '#4d4b47'); hg.addColorStop(1, '#141413');
          ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(p.px + 4, p.py + 6, r, 0, 7); ctx.fill();
          ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(p.px, p.py, r, 0, 7); ctx.fill();
          ctx.fillStyle = p.ink; ctx.beginPath(); ctx.arc(p.px, p.py, 5, 0, 7); ctx.fill();
        });
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        let tg = ctx.createLinearGradient(0, 0, 0, 80); tg.addColorStop(0, 'rgba(0,0,0,.55)'); tg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 80);
        if (IW * S < W) {
          const l = OX, r = OX + IW * S;
          tg = ctx.createLinearGradient(l, 0, l + 30, 0); tg.addColorStop(0, '#050505'); tg.addColorStop(1, 'rgba(5,5,5,0)'); ctx.fillStyle = tg; ctx.fillRect(l, 0, 30, H);
          tg = ctx.createLinearGradient(r - 30, 0, r, 0); tg.addColorStop(0, 'rgba(5,5,5,0)'); tg.addColorStop(1, '#050505'); ctx.fillStyle = tg; ctx.fillRect(r - 30, 0, 30, H);
        }
        tg = ctx.createLinearGradient(0, IH * S - 60, 0, IH * S); tg.addColorStop(0, 'rgba(5,5,5,0)'); tg.addColorStop(1, '#050505'); ctx.fillStyle = tg; ctx.fillRect(0, IH * S - 60, W, 60);
      }

      function frame(now: number) {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        tick(dt); draw(); raf = requestAnimationFrame(frame);
      }
      const onVis = () => { running = !document.hidden; if (running) { last = performance.now(); raf = requestAnimationFrame(frame); } };
      document.addEventListener('visibilitychange', onVis);
      api.current.relayout = () => { layout(); draw(); };
      const ro = new ResizeObserver(() => { layout(); draw(); });
      ro.observe(box);

      layout(); draw();
      const im = new Image();
      im.onload = () => {
        img = im; buildLayers(); layout();
        const pre = Math.ceil(((PAPER.y1 - 900) / SPEED) * 60);
        for (let i = 0; i < pre; i++) tick(1 / 60);
        draw(); last = performance.now(); raf = requestAnimationFrame(frame);
      };
      im.src = '/maquina.jpg';
      return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); };
    }, []);

    useEffect(() => { api.current.relayout(); }, [panelHeight]);

    return (
      <div ref={wrap} className="poly" onPointerDown={() => { api.current.jolt(0.45); onTap?.(); }}>
        <canvas ref={canvas} aria-label={label} role="img" />
      </div>
    );
  },
);
