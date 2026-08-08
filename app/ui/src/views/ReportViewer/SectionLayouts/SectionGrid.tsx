import { ReactNode, memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type GridItem, GRID_COLUMNS, GRID_ROW_HEIGHT, GRID_GAP, GRID_ROW_GAP } from './sectionLayoutStore';
import { GridItemContext } from './GridItemContext';
import { useGridInteraction } from './useGridInteraction';
import { type GridSelection } from './GridSelection';
import styles from './SectionGrid.module.css';

export interface SectionGridRenderItem {
  key: string;
  title: string;
  /** Optional rich title (e.g. editable) rendered in place of `title`. */
  titleNode?: ReactNode;
  content: ReactNode;
  /** Fixed pixel height for the chart content in locked (non-editable) mode. */
  chartHeightPx?: number;
  /** Description text shown below the title in locked mode. */
  description?: string;
  /** Called when the user edits the description in locked mode. */
  onDescriptionChange?: (value: string) => void;
}

export interface SectionGridProps {
  items: SectionGridRenderItem[];
  layout: GridItem[];
  /** Multi-cell selection, owned by the parent so it can drive a toolbar. */
  selection: GridSelection;
  columns?: number;
  rowHeight?: number;
  gap?: number;
  rowGap?: number;
  editable?: boolean;
  /** Number of display columns; used for masonry grouping in locked mode. */
  columnsPerRow?: number;
  /** Current pan-zoom scale, so tile drag/resize stays accurate when zoomed. */
  scale?: number;
  /** Card/viewport width (px) that sizes the grid columns on the free canvas. */
  viewportWidth?: number;
  onLayoutChange: (items: GridItem[]) => void;
  onItemClick?: (key: string) => void;
}

// ── Shared sub-components ────────────────────────────────────────────────

const ItemDescription = memo<{ item: SectionGridRenderItem }>(({ item }) => {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [editing]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        className={styles.itemDescriptionInput}
        defaultValue={item.description ?? ''}
        placeholder="Add a description..."
        onInput={(e) => autoResize(e.currentTarget)}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setEditing(false); } }}
        onBlur={(e) => { item.onDescriptionChange?.(e.target.value); setEditing(false); }}
      />
    );
  }
  return (
    <div
      className={item.description ? styles.itemDescription : styles.itemDescriptionPlaceholder}
      onDoubleClick={(e) => { if (!item.onDescriptionChange) return; e.stopPropagation(); setEditing(true); }}
    >
      {item.description || (item.onDescriptionChange ? 'Add a description...' : null)}
    </div>
  );
});

// ── Locked (masonry) mode ────────────────────────────────────────────────

const LockedGridItem = memo<{ item: SectionGridRenderItem }>(({ item }) => (
  <div className={styles.lockedItem}>
    <div className={styles.lockedItemHeader}>{item.titleNode ?? item.title}</div>
    <ItemDescription item={item} />
    <div
      className={`${styles.lockedItemChart}${item.chartHeightPx != null ? ` ${styles.lockedItemChartFixed}` : ''}`}
      style={item.chartHeightPx != null ? { height: item.chartHeightPx } : undefined}
    >
      <GridItemContext.Provider value={{ cols: 1 }}>
        {item.content}
      </GridItemContext.Provider>
    </div>
  </div>
));

function MasonrySectionGrid({
  items,
  layout,
  gap = GRID_GAP,
  rowGap = GRID_ROW_GAP,
  columnsPerRow,
  columns = GRID_COLUMNS,
}: Pick<SectionGridProps, 'items' | 'layout' | 'gap' | 'rowGap' | 'columnsPerRow' | 'columns'>) {
  const nCols = columnsPerRow ?? (() => {
    if (layout.length === 0) return 1;
    const w = layout[0].w;
    return w > 0 ? Math.round(columns / w) : 1;
  })();
  const colWidth = columns / nCols;

  const layoutMap = new Map(layout.map((l) => [l.key, l]));

  const buckets: Array<SectionGridRenderItem[]> = Array.from({ length: nCols }, () => []);
  for (const item of items) {
    const pos = layoutMap.get(item.key);
    if (!pos) continue;
    const colIdx = Math.max(0, Math.min(Math.floor(pos.x / colWidth + 0.5), nCols - 1));
    buckets[colIdx].push(item);
  }
  for (const bucket of buckets) {
    bucket.sort((a, b) => (layoutMap.get(a.key)?.y ?? 0) - (layoutMap.get(b.key)?.y ?? 0));
  }

  return (
    <div className={styles.lockedGrid} style={{ gap }}>
      {buckets.map((bucket, ci) => (
        <div key={ci} className={styles.lockedColumn} style={{ gap: rowGap }}>
          {bucket.map((item) => (
            <LockedGridItem key={item.key} item={item} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Editable (drag/resize) mode ──────────────────────────────────────────

/**
 * One editable tile. Measures its own header/description chrome so the tile
 * gets a *definite* height (chrome + the chart's intended height), which both
 * lets the chart fill (percentage heights need a definite parent) and grows the
 * tile downward for a tall wrapped title instead of squeezing the figure.
 */
const EditableGridItem = memo<{
  item: SectionGridRenderItem;
  cols: number;
  left: number;
  top: number;
  width: number;
  baseHeight: number;
  zIndex: number;
  className: string;
  onStartMove: (e: React.PointerEvent) => void;
  onStartResize: (e: React.PointerEvent, edge: 'right' | 'bottom' | 'corner') => void;
}>(({ item, cols, left, top, width, baseHeight, zIndex, className, onStartMove, onStartResize }) => {
  const chromeRef = useRef<HTMLDivElement>(null);
  const [chromeH, setChromeH] = useState(0);
  useLayoutEffect(() => {
    const el = chromeRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChromeH(el.offsetHeight));
    ro.observe(el);
    setChromeH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  // Definite height: at least the stored span, but never less than the wrapped
  // chrome plus the chart's intended height, so the figure is never clipped.
  const height = item.chartHeightPx != null ? Math.max(baseHeight, chromeH + item.chartHeightPx) : baseHeight;

  return (
    <div className={className} style={{ left, top, width, height, zIndex }} data-no-pan>
      <div ref={chromeRef} className={styles.itemChrome}>
        <div className={styles.itemHeader} onPointerDown={onStartMove} title={item.title}>
          {item.titleNode ?? item.title}
        </div>
        <ItemDescription item={item} />
      </div>
      <div className={styles.itemBody}>
        <GridItemContext.Provider value={{ cols }}>
          {item.content}
        </GridItemContext.Provider>
      </div>
      <div className={styles.handle + ' ' + styles.handleRight} onPointerDown={(e) => onStartResize(e, 'right')} />
      <div className={styles.handle + ' ' + styles.handleBottom} onPointerDown={(e) => onStartResize(e, 'bottom')} />
      <div className={styles.handle + ' ' + styles.handleCorner} onPointerDown={(e) => onStartResize(e, 'corner')} />
    </div>
  );
});
EditableGridItem.displayName = 'EditableGridItem';

/**
 * A self-contained widget canvas. Items hold a free (x, y) position; each spans
 * a whole number of columns/rows. Items can be moved (drag the header) and
 * resized (drag the right / bottom / corner handles); changes snap to grid
 * units, commit raw (no collision/reflow) and are reported via `onLayoutChange`.
 *
 * All drag/resize behaviour lives in {@link useGridInteraction}; this component
 * is purely presentational.
 */
function EditableSectionGrid({
  items,
  layout,
  selection: selectionProp,
  columns = GRID_COLUMNS,
  rowHeight = GRID_ROW_HEIGHT,
  gap = GRID_GAP,
  rowGap = GRID_ROW_GAP,
  scale = 1,
  viewportWidth = 0,
  onLayoutChange,
  onItemClick,
}: SectionGridProps) {
  const {
    containerRef,
    containerWidth,
    layoutMap,
    cellWidth,
    colSpan,
    rowSpan,
    canvasWidth,
    canvasHeight,
    originX,
    originY,
    zOrder,
    draggingKey,
    selection,
    startMove,
    startResize,
  } = useGridInteraction({ items, layout, columns, rowHeight, gap, rowGap, editable: true, selection: selectionProp, scale, viewportWidth, onLayoutChange, onItemClick });

  return (
    <div ref={containerRef} className={styles.grid} style={{ width: canvasWidth, height: canvasHeight }}>
      {containerWidth > 0 && items.map((item) => {
        const pos = layoutMap.get(item.key);
        if (!pos) return null;
        const width = pos.w * cellWidth + (pos.w - 1) * gap;
        const baseHeight = pos.h * rowHeight - rowGap;
        const isDragging = draggingKey === item.key;
        const isSelected = selection.isSelected(item.key);

        // Free position, offset by the canvas origin so negative-space items and
        // the leftmost/topmost tiles render within the visible canvas.
        const left = (pos.x - originX) * colSpan + 10;
        const top = (pos.y - originY) * rowSpan + 100;
        const zIndex = zOrder.indexOf(item.key) + 1;

        const className = [
          styles.item,
          isSelected ? styles.itemSelected : '',
          isDragging ? styles.itemDragging : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <EditableGridItem
            key={item.key}
            item={item}
            cols={pos.w}
            left={left}
            top={top}
            width={width}
            baseHeight={baseHeight}
            zIndex={zIndex}
            className={className}
            onStartMove={(e) => startMove(e, item.key)}
            onStartResize={(e, edge) => startResize(e, item.key, edge)}
          />
        );
      })}
    </div>
  );
}

// ── Public component ─────────────────────────────────────────────────────

export function SectionGrid(props: SectionGridProps) {
  if (!props.editable) {
    return (
      <MasonrySectionGrid
        items={props.items}
        layout={props.layout}
        gap={props.gap}
        rowGap={props.rowGap}
        columnsPerRow={props.columnsPerRow}
        columns={props.columns}
      />
    );
  }
  return <EditableSectionGrid {...props} />;
}
