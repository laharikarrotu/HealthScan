'use client';

import { useEffect, useRef } from 'react';

/** Fixed canvas behind page content (z-[1]); pairs with `.hs-page` mesh at z-0. */
export default function HealthAmbientParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const rawCtx = el.getContext('2d');
    if (!rawCtx) return;
    const graphics: CanvasRenderingContext2D = rawCtx;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;

    type Dot = { x: number; y: number; vx: number; vy: number; r: number; hue: number };
    type Pulse = { x: number; y: number; t: number; speed: number };
    type Cross = { x: number; y: number; rot: number; vr: number; size: number };
    type Link = { ax: number; ay: number; bx: number; by: number; phase: number };

    const dots: Dot[] = [];
    const pulses: Pulse[] = [];
    const crosses: Cross[] = [];
    const links: Link[] = [];
    const ecgOffsets: number[] = [];

    function seed() {
      dots.length = 0;
      pulses.length = 0;
      crosses.length = 0;
      links.length = 0;
      ecgOffsets.length = 0;

      const n = Math.min(48, Math.floor((w * h) / 28000) + 18);
      for (let i = 0; i < n; i++) {
        dots.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          r: 0.6 + Math.random() * 1.8,
          hue: Math.random() < 0.45 ? 0 : Math.random() < 0.5 ? 1 : 2,
        });
      }

      for (let i = 0; i < 5; i++) {
        pulses.push({
          x: Math.random() * w,
          y: Math.random() * h,
          t: Math.random() * Math.PI * 2,
          speed: 0.012 + Math.random() * 0.018,
        });
      }

      for (let i = 0; i < 4; i++) {
        crosses.push({
          x: Math.random() * w,
          y: Math.random() * h,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.003,
          size: 5 + Math.random() * 5,
        });
      }

      for (let i = 0; i < 6; i++) {
        const ax = Math.random() * w;
        const ay = Math.random() * h;
        const len = 40 + Math.random() * 100;
        const ang = Math.random() * Math.PI * 2;
        links.push({
          ax,
          ay,
          bx: ax + Math.cos(ang) * len,
          by: ay + Math.sin(ang) * len,
          phase: Math.random() * Math.PI * 2,
        });
      }

      for (let i = 0; i < 4; i++) {
        ecgOffsets.push(Math.random() * w);
      }
    }

    function resize() {
      const c = canvasRef.current;
      if (!c) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      graphics.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function ecgSample(u: number): number {
      const p = u % 1;
      if (p < 0.08) return 0;
      if (p < 0.1) return -5;
      if (p < 0.105) return 14;
      if (p < 0.12) return -6;
      if (p < 0.2) return 0;
      if (p < 0.22) return 5;
      if (p < 0.28) return 0;
      return 0;
    }

    function drawEcgStrip(y: number, scroll: number, offset: number, alpha: number) {
      const amp = 4.5;
      const step = 3;
      const base = y;
      graphics.beginPath();
      let first = true;
      for (let x = -20; x < w + 40; x += step) {
        const u = (x + scroll + offset) * 0.018;
        const yy = base + ecgSample(u) * amp;
        if (first) {
          graphics.moveTo(x, yy);
          first = false;
        } else {
          graphics.lineTo(x, yy);
        }
      }
      graphics.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
      graphics.lineWidth = 1;
      graphics.stroke();
    }

    function drawStatic() {
      graphics.clearRect(0, 0, w, h);
      for (const d of dots) {
        const c =
          d.hue === 0
            ? 'rgba(6, 182, 212, 0.14)'
            : d.hue === 1
              ? 'rgba(16, 185, 129, 0.12)'
              : 'rgba(100, 116, 139, 0.1)';
        graphics.fillStyle = c;
        graphics.beginPath();
        graphics.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        graphics.fill();
      }
    }

    let t = 0;
    const scrollSpeed = 28;

    function frame() {
      t += 0.016;
      graphics.clearRect(0, 0, w, h);

      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -8) d.x = w + 8;
        if (d.x > w + 8) d.x = -8;
        if (d.y < -8) d.y = h + 8;
        if (d.y > h + 8) d.y = -8;
        const c =
          d.hue === 0
            ? 'rgba(6, 182, 212, 0.16)'
            : d.hue === 1
              ? 'rgba(16, 185, 129, 0.13)'
              : 'rgba(100, 116, 139, 0.11)';
        graphics.fillStyle = c;
        graphics.beginPath();
        graphics.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        graphics.fill();
      }

      const linkAlpha = (phase: number) => 0.04 + Math.sin(t * 1.2 + phase) * 0.035;
      for (const L of links) {
        graphics.beginPath();
        graphics.moveTo(L.ax, L.ay);
        graphics.lineTo(L.bx, L.by);
        graphics.strokeStyle = `rgba(14, 165, 233, ${linkAlpha(L.phase)})`;
        graphics.lineWidth = 0.85;
        graphics.stroke();
        graphics.fillStyle = `rgba(14, 165, 233, ${0.1 + linkAlpha(L.phase) * 0.5})`;
        for (const p of [
          [L.ax, L.ay],
          [L.bx, L.by],
        ] as const) {
          graphics.beginPath();
          graphics.arc(p[0], p[1], 2.2, 0, Math.PI * 2);
          graphics.fill();
        }
      }

      for (const p of pulses) {
        p.t += p.speed;
        const radius = ((p.t * 0.5) % 1) * 90 + 8;
        const a = Math.max(0, 0.14 * (1 - radius / 98));
        graphics.beginPath();
        graphics.arc(p.x, p.y, radius, 0, Math.PI * 2);
        graphics.strokeStyle = `rgba(16, 185, 129, ${a})`;
        graphics.lineWidth = 1.2;
        graphics.stroke();
      }

      for (const c of crosses) {
        c.rot += c.vr;
        c.x += Math.sin(t * 0.4 + c.rot) * 0.15;
        c.y += Math.cos(t * 0.35 + c.rot) * 0.12;
        graphics.save();
        graphics.translate(c.x, c.y);
        graphics.rotate(c.rot);
        graphics.strokeStyle = 'rgba(100, 116, 139, 0.11)';
        graphics.lineWidth = 1;
        const s = c.size;
        graphics.beginPath();
        graphics.moveTo(-s, 0);
        graphics.lineTo(s, 0);
        graphics.moveTo(0, -s);
        graphics.lineTo(0, s);
        graphics.stroke();
        graphics.restore();
      }

      const scroll = t * scrollSpeed;
      drawEcgStrip(h * 0.22, scroll, ecgOffsets[0] ?? 0, 0.11);
      drawEcgStrip(h * 0.78, scroll * 0.85, ecgOffsets[1] ?? 0, 0.09);
      drawEcgStrip(h * 0.52, scroll * 1.1, ecgOffsets[2] ?? 0, 0.07);

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);

    const onMotionChange = () => {
      cancelAnimationFrame(raf);
      if (reducedMotion.matches) {
        drawStatic();
      } else {
        raf = requestAnimationFrame(frame);
      }
    };

    onMotionChange();
    reducedMotion.addEventListener('change', onMotionChange);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      reducedMotion.removeEventListener('change', onMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="hs-ambient-canvas pointer-events-none fixed inset-0 z-[1] opacity-[0.38]"
      aria-hidden
    />
  );
}
