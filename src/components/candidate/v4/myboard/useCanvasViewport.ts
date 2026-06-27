import { useCallback, useEffect, useRef, useState } from 'react';

export interface Rect { x: number; y: number; w: number; h: number; }
export interface Viewport { x: number; y: number; scale: number; }

interface Options {
  minScale?: number;
  maxScale?: number;
}

export function useCanvasViewport(opts: Options = {}) {
  const minScale = opts.minScale ?? 0.15;
  const maxScale = opts.maxScale ?? 2.5;

  const outerRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const scaleRef = useRef<number>(0.5);
  const drag = useRef({ on: false, sx: 0, sy: 0, ox: 0, oy: 0, moved: false });

  const [offset, _setOffset] = useState({ x: 0, y: 0 });
  const [scale, _setScale] = useState(0.5);
  const [anim, setAnim] = useState(true);

  const setOffset = useCallback((o: { x: number; y: number }) => {
    offsetRef.current = o; _setOffset(o);
  }, []);
  const setScale = useCallback((s: number) => {
    scaleRef.current = s; _setScale(s);
  }, []);

  const panTo = useCallback((x: number, y: number, sc: number) => {
    setAnim(true);
    setScale(sc); setOffset({ x, y });
  }, [setOffset, setScale]);

  const fitRect = useCallback((rect: Rect, padding = 80) => {
    const el = outerRef.current; if (!el) return;
    const vpW = el.clientWidth, vpH = el.clientHeight;
    const sc = Math.min(
      (vpW - padding * 2) / rect.w,
      (vpH - padding * 2) / rect.h,
      maxScale,
    );
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    panTo(vpW / 2 - cx * sc, vpH / 2 - cy * sc, sc);
  }, [panTo, maxScale]);

  const zoomBy = useCallback((factor: number) => {
    const el = outerRef.current; if (!el) return;
    const mx = el.clientWidth / 2, my = el.clientHeight / 2;
    const ns = Math.min(Math.max(scaleRef.current * factor, minScale), maxScale);
    const nx = mx - (mx - offsetRef.current.x) * (ns / scaleRef.current);
    const ny = my - (my - offsetRef.current.y) * (ns / scaleRef.current);
    setAnim(true);
    setScale(ns); setOffset({ x: nx, y: ny });
  }, [minScale, maxScale, setOffset, setScale]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-board-panel="true"]')) return;
    if (target.closest('[data-canvas-toolbar="true"]')) return;
    drag.current = {
      on: true, sx: e.clientX, sy: e.clientY,
      ox: offsetRef.current.x, oy: offsetRef.current.y, moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag.current.on) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
    const nx = drag.current.ox + dx;
    const ny = drag.current.oy + dy;
    setAnim(false);
    offsetRef.current = { x: nx, y: ny };
    _setOffset({ x: nx, y: ny });
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    drag.current.on = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    (e.currentTarget as HTMLElement).style.cursor = 'grab';
  }, []);

  useEffect(() => {
    const el = outerRef.current; if (!el) return;
    const handler = (e: WheelEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (targetEl && targetEl.closest('[data-board-scroll="true"]') && !(e.ctrlKey || e.metaKey)) {
        return;
      }
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const d = e.deltaY < 0 ? 1.08 : 0.92;
        const ns = Math.min(Math.max(scaleRef.current * d, minScale), maxScale);
        const nx = mx - (mx - offsetRef.current.x) * (ns / scaleRef.current);
        const ny = my - (my - offsetRef.current.y) * (ns / scaleRef.current);
        scaleRef.current = ns; offsetRef.current = { x: nx, y: ny };
        setAnim(false); _setScale(ns); _setOffset({ x: nx, y: ny });
      } else {
        const nx = offsetRef.current.x - e.deltaX;
        const ny = offsetRef.current.y - e.deltaY;
        offsetRef.current = { x: nx, y: ny };
        setAnim(false); _setOffset({ x: nx, y: ny });
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [minScale, maxScale]);

  return {
    outerRef,
    offset, scale, anim,
    setAnim,
    panTo, fitRect, zoomBy,
    onPointerDown, onPointerMove, onPointerUp,
    dragMovedRef: drag,
  };
}
