import { useSyncExternalStore, useCallback } from 'react';

type Listener = () => void;

interface ActiveState {
  index: number | null;
}

let state: ActiveState = { index: null };
const listeners = new Set<Listener>();

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function toggle(index: number) {
  const next: ActiveState = { index: state.index === index ? null : index };
  state = next;
  listeners.forEach((l) => l());
}

export function useBarHoverStore() {
  const current = useSyncExternalStore(subscribe, getSnapshot);

  const onClick = useCallback((i: number) => toggle(i), []);

  return {
    activeIndex: current.index,
    onClick,
  };
}
