import { createContext, useContext } from 'react';

interface GridItemContextValue {
  /** Width of this grid item in grid columns. `Infinity` outside a grid context. */
  cols: number;
}

export const GridItemContext = createContext<GridItemContextValue>({ cols: Infinity });

/** Returns the grid-column width of the enclosing grid item, or Infinity when outside a grid. */
export function useGridItemCols(): number {
  return useContext(GridItemContext).cols;
}
