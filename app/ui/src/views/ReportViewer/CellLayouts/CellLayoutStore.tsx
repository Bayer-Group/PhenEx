import { createContext, useContext, useCallback, useRef, useSyncExternalStore, FC, ReactNode } from 'react';
import { type IJsonModel } from 'flexlayout-react';

type RowType = string;
type Listener = () => void;

class CellLayoutStore {
  private layouts = new Map<RowType, IJsonModel>();
  private listeners = new Set<Listener>();

  getLayout(rowType: RowType): IJsonModel | undefined {
    return this.layouts.get(rowType);
  }

  setLayout(rowType: RowType, json: IJsonModel) {
    this.layouts.set(rowType, json);
    this.notify();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  getSnapshot() {
    return this.layouts;
  }
}

const StoreContext = createContext<CellLayoutStore | null>(null);

export const CellLayoutStoreProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const storeRef = useRef<CellLayoutStore>();
  if (!storeRef.current) storeRef.current = new CellLayoutStore();
  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>;
};

export function useCellLayoutStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useCellLayoutStore must be used within CellLayoutStoreProvider');
  return store;
}

export function useSharedLayout(rowType: RowType, defaultJson: IJsonModel): [IJsonModel, (json: IJsonModel) => void] {
  const store = useCellLayoutStore();

  const subscribe = useCallback((cb: Listener) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => store.getLayout(rowType) ?? defaultJson, [store, rowType, defaultJson]);

  const currentJson = useSyncExternalStore(subscribe, getSnapshot);

  const updateLayout = useCallback(
    (json: IJsonModel) => { store.setLayout(rowType, json); },
    [store, rowType],
  );

  return [currentJson, updateLayout];
}
