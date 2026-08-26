import { createContext, useContext, useCallback, useRef, useSyncExternalStore, FC, ReactNode } from 'react';
import { Model, type IJsonModel } from 'flexlayout-react';
import { hasCommentsTabset, removeCommentsTabset, addCommentsTabset } from './cellLayoutComments';

type RowType = string;
type Listener = () => void;

interface LayoutEntry {
  json: IJsonModel;
  version: number;
}

class CellLayoutStore {
  private layouts = new Map<RowType, LayoutEntry>();
  /** Shared across boolean / categorical / numeric layouts. */
  private commentsVisible = true;
  private commentsRevision = 0;
  private listeners = new Set<Listener>();

  getEntry(rowType: RowType): LayoutEntry | undefined {
    return this.layouts.get(rowType);
  }

  getCommentsVisible(): boolean {
    return this.commentsVisible;
  }

  getCommentsRevision(): number {
    return this.commentsRevision;
  }

  /** Toggle comments panel visibility for every cell layout type. */
  setCommentsVisible(visible: boolean) {
    if (this.commentsVisible === visible) return;
    this.commentsVisible = visible;
    this.commentsRevision++;

    for (const [rowType, entry] of this.layouts) {
      const nextJson = visible
        ? (hasCommentsTabset(entry.json) ? entry.json : addCommentsTabset(entry.json))
        : removeCommentsTabset(entry.json);
      this.layouts.set(rowType, { json: nextJson, version: entry.version + 1 });
    }
    this.notify();
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

export { useCellLayoutStore };

export function useSharedModel(rowType: RowType, defaultJson: IJsonModel): [Model, (model: Model) => void] {
  const store = useCellLayoutStore();
  const modelRef = useRef<Model | null>(null);
  const snapshotRef = useRef('');

  const subscribe = useCallback((cb: Listener) => store.subscribe(cb), [store]);
  const getSnapshot = useCallback(() => {
    const entry = store.getEntry(rowType);
    return `${entry?.version ?? -1}:${store.getCommentsRevision()}`;
  }, [store, rowType]);

  const storeSnapshot = useSyncExternalStore(subscribe, getSnapshot);

  const resolveJson = useCallback((json: IJsonModel): IJsonModel => {
    if (store.getCommentsVisible()) {
      return hasCommentsTabset(json) ? json : addCommentsTabset(json);
    }
    return hasCommentsTabset(json) ? removeCommentsTabset(json) : json;
  }, [store]);

  if (modelRef.current === null) {
    const entry = store.getEntry(rowType);
    modelRef.current = Model.fromJson(resolveJson(entry?.json ?? defaultJson));
    snapshotRef.current = storeSnapshot;
  } else if (storeSnapshot !== snapshotRef.current) {
    const entry = store.getEntry(rowType);
    const json = entry?.json ?? (modelRef.current.toJson() as IJsonModel);
    modelRef.current = Model.fromJson(resolveJson(json));
    snapshotRef.current = storeSnapshot;
  }

  const propagateChange = useCallback(
    (model: Model) => {
      const json = model.toJson() as IJsonModel;
      store.setLayout(rowType, json);
      snapshotRef.current = `${store.getEntry(rowType)?.version ?? -1}:${store.getCommentsRevision()}`;
    },
    [store, rowType],
  );

  return [modelRef.current, propagateChange];
}
