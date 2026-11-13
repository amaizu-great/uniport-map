"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface BottomSheetProps {
  /**
   * Snap heights, smallest first. Values ≤ 1 are fractions of the screen height,
   * larger values are pixels.
   */
  snaps: number[];
  snap: number;
  onSnapChange: (index: number) => void;
  /** Reports the visible height so floating controls can sit above the sheet. */
  onHeightChange?: (px: number, containerPx: number) => void;
  header?: ReactNode;
  children: ReactNode;
  label: string;
}

const DRAG_THRESHOLD = 6;

/**
 * A Google-Maps-style sheet: drag the handle or header to resize, it snaps to the
 * nearest stop (or the next one on a flick). Content only scrolls at the top stop;
 * below that, swiping up on the content expands the sheet instead.
 */
export default function BottomSheet({
  snaps,
  snap,
  onSnapChange,
  onHeightChange,
  header,
  children,
  label,
}: BottomSheetProps) {
  const ref = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState(0);
  const [dragH, setDragH] = useState<number | null>(null);
  const drag = useRef<{ y: number; h: number; t: number; active: boolean; id: number } | null>(null);

  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => setContainerH(parent.clientHeight));
    ro.observe(parent);
    setContainerH(parent.clientHeight);
    return () => ro.disconnect();
  }, []);

  const heights = snaps.map((s) => (s <= 1 ? s * containerH : s));
  const current = Math.min(snap, heights.length - 1);
  const height = dragH ?? heights[current] ?? 0;
  const atTop = current === heights.length - 1 && dragH === null;

  useEffect(() => {
    if (containerH) onHeightChange?.(height, containerH);
  }, [height, containerH, onHeightChange]);

  function nearest(h: number, velocity: number) {
    // A quick flick moves one stop in the flick's direction.
    if (Math.abs(velocity) > 0.5) {
      const dir = velocity < 0 ? 1 : -1;
      return Math.max(0, Math.min(heights.length - 1, current + dir));
    }
    let best = 0;
    heights.forEach((v, i) => {
      if (Math.abs(v - h) < Math.abs(heights[best] - h)) best = i;
    });
    return best;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const inBody = bodyRef.current?.contains(e.target as Node);
    // At the top stop, the body scrolls natively; only the header drags.
    if (inBody && atTop) return;
    drag.current = { y: e.clientY, h: height, t: e.timeStamp, active: false, id: e.pointerId };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(dy) < DRAG_THRESHOLD) return;
      d.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const min = heights[0] * 0.6;
    const max = heights[heights.length - 1];
    setDragH(Math.max(min, Math.min(max, d.h - dy)));
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    const velocity = (e.clientY - d.y) / Math.max(1, e.timeStamp - d.t);
    const h = d.h - (e.clientY - d.y);
    setDragH(null);
    onSnapChange(nearest(h, velocity));
  }

  function onWheel(e: React.WheelEvent) {
    // Desktop: scrolling over the sheet expands/collapses it like a swipe.
    const body = bodyRef.current;
    if (e.deltaY > 0 && !atTop) onSnapChange(Math.min(heights.length - 1, current + 1));
    else if (e.deltaY < 0 && current > 0 && (!atTop || (body?.scrollTop ?? 0) <= 0)) onSnapChange(current - 1);
  }

  return (
    <section
      ref={ref}
      aria-label={label}
      className="absolute inset-x-0 bottom-0 z-[1100] flex flex-col overflow-hidden rounded-t-[28px] border-t border-line bg-surface shadow-sheet"
      style={{
        height,
        transition: dragH === null ? "height 320ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
        visibility: containerH ? "visible" : "hidden",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div className="shrink-0 touch-none">
        <button
          type="button"
          aria-label={atTop ? "Collapse panel" : "Expand panel"}
          onClick={() => onSnapChange(atTop ? 0 : current + 1)}
          className="flex h-6 w-full items-center justify-center"
        >
          <span className="h-1.5 w-10 rounded-full bg-surface-3" />
        </button>
        {header}
      </div>
      <div
        ref={bodyRef}
        className="no-scrollbar min-h-0 flex-1 overscroll-contain pb-[env(safe-area-inset-bottom)]"
        style={{ overflowY: atTop ? "auto" : "hidden", touchAction: atTop ? "pan-y" : "none" }}
      >
        {children}
      </div>
    </section>
  );
}
