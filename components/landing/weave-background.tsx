'use client';

import { useEffect, useRef } from 'react';

type WeaveBackgroundProps = {
  /** Matiz base dos fios (HSL). O protótipo usa 285 e desloca -15 na base. */
  hue?: number;
  enabled?: boolean;
};

// Fios de IA "se entrelaçando" desenhados em canvas, cobrindo a página inteira.
// Recriação fiel do loop do protótipo (32 fios senoidais, blend "lighter").
export function WeaveBackground({ hue = 285, enabled = true }: WeaveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const node = canvasRef.current;
    if (!node) return;
    const ctx = node.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;
    const threads = 32;
    const baseHue = hue - 15;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = node.clientWidth;
      h = node.clientHeight;
      node.width = Math.max(1, w * dpr);
      node.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduceMotion) draw(); // redesenha o frame estático ao redimensionar
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < threads; i++) {
        const p = i / threads;
        const baseY = p * h;
        const env = Math.sin(p * Math.PI);
        const hueI = baseHue + p * 55;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const y =
            baseY +
            Math.sin(x * 0.006 + t * 0.6 + i * 0.5) * 46 * env +
            Math.sin(x * 0.002 - t * 0.32 + i) * 22 * env;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${hueI},75%,66%,${0.05 + env * 0.12})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
      if (reduceMotion) return; // movimento reduzido: um único frame
      t += 0.016;
      raf = requestAnimationFrame(draw);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(node);
    window.addEventListener('resize', resize);
    if (!reduceMotion) draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [hue, enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
    />
  );
}
