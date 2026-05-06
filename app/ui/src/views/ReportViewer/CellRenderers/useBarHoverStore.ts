import { useSyncExternalStore, useCallback } from 'react';

type Listener = () => void;

interface HoverState {
  index: number | null;
  mouseX: number;
  mouseY: number;
}

let state: HoverState = { index: null, mouseX: 0, mouseY: 0 };
const listeners = new Set<Listener>();

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function setHover(index: number | null, x?: number, y?: number) {
  const next: HoverState = {
    index,
    mouseX: x ?? state.mouseX,
    mouseY: y ?? state.mouseY,
  };
  if (next.index === state.index && next.mouseX === state.mouseX && next.mouseY === state.mouseY) return;
  state = next;
  listeners.forEach((l) => l());
}

export function useBarHoverStore() {
  const current = useSyncExternalStore(subscribe, getSnapshot);

  const onEnter = useCallback((i: number, e: React.MouseEvent) => setHover(i, e.clientX, e.clientY), []);
  const onMove = useCallback((e: React.MouseEvent) => setHover(state.index, e.clientX, e.clientY), []);
  const onLeave = useCallback(() => setHover(null), []);

  return {
    hoveredIndex: current.index,
    mouseX: current.mouseX,
    mouseY: current.mouseY,
    onEnter,
    onMove,
    onLeave,
  };
}
