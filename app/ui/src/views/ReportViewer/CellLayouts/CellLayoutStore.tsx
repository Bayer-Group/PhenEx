import { createContext, useContext, useCallback, useRef, useSyncExternalStore, FC, ReactNode } from 'react';
import { Model, type IJsonModel } from 'flexlayout-react';

type RowType = string;
type Listener = () => void;

interface LayoutEntry {
  json: IJsonModel;
  version: number;
}

class CellLayoutStore {
  private layouts = new Map<RowType, LayoutEntry>();
  private listeners = new Set<Listener>();

  getEntry(rowType: RowType): LayoutEntry | undefined {
    return this.layouts.get(rowType);
  }

  setLayout(rowType: RowType, json: IJsonModel) {
    const prev = this.layouts.get(rowType);
    const version = (prev?.version ?? 0) + 1;
    this.layouts.set(rowType, { json, version });
    this.notify();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    for (const l of this.listeners) l();
  }
}

const StoreContext = createContext<CellLayoutStore | null>(null);

export const CellLayoutStoreProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const storeRef = useRef<CellLayoutStore>();
  if (!storeRef.current) storeRef.current = new CellLayoutStore();
  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>;
};

function useCellLayoutStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useCellLayoutStore must be used within CellLayoutStoreProvider');
  return store;
}

export function useSharedModel(rowType: RowType, defaultJson: IJsonModel): [Model, (model: Model) => void] {
  const store = useCellLayoutStore();
  const modelRef = useRef<Model | null>(null);
  const versionRef = useRef<number>(-1);

  const subscribe = useCallback((cb: Listener) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => store.getEntry(rowType)?.version ?? -1, [store, rowType]);

  const storeVersion = useSyncExternalStore(subscribe, getSnapshot);

  // Create or update model only when store version changes from an external source
  if (modelRef.current === null) {
    const entry = store.getEntry(rowType);
    modelRef.current = Model.fromJson(entry?.json ?? defaultJson);
    versionRef.current = entry?.version ?? -1;
  } else if (storeVersion !== versionRef.current) {
    const entry = store.getEntry(rowType);
    if (entry) {
      modelRef.current = Model.fromJson(entry.json);
      versionRef.current = entry.version;
    }
  }

  const propagateChange = useCallback(
    (model: Model) => {
      const json = model.toJson() as IJsonModel;
      store.setLayout(rowType, json);
      // Immediately track our own version so we don't rebuild from it
      const entry = store.getEntry(rowType);
      if (entry) versionRef.current = entry.version;
    },
    [store, rowType],
  );

  return [modelRef.current, propagateChange];
}
