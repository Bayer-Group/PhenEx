import { ReactNode, memo, useEffect, useRef, useState } from 'react';
import { type GridItem, GRID_COLUMNS, GRID_ROW_HEIGHT, GRID_GAP, GRID_ROW_GAP } from './sectionLayoutStore';
import { GridItemContext } from './GridItemContext';
import { useGridInteraction, STACK_OFFSET } from './useGridInteraction';
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
  onLayoutChange: (items: GridItem[]) => void;
  onItemClick?: (key: string) => void;
}

// ── Locked (masonry) mode ────────────────────────────────────────────────

const LockedGridItem = memo<{ item: SectionGridRenderItem }>(({ item }) => {
  const [editingDesc, setEditingDesc] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editingDesc) return;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [editingDesc]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  return (
    <div className={styles.lockedItem}>
      <div className={styles.lockedItemHeader}>{item.titleNode ?? item.title}</div>

      {editingDesc ? (
        <textarea
          ref={textareaRef}
          className={styles.itemDescriptionInput}
          defaultValue={item.description ?? ''}
          placeholder="Add a description..."
          onInput={(e) => autoResize(e.currentTarget)}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setEditingDesc(false); } }}
          onBlur={(e) => { item.onDescriptionChange?.(e.target.value); setEditingDesc(false); }}
        />
      ) : (
        <div
          className={item.description ? styles.itemDescription : styles.itemDescriptionPlaceholder}
          onDoubleClick={(e) => { if (!item.onDescriptionChange) return; e.stopPropagation(); setEditingDesc(true); }}
        >
          {item.description || (item.onDescriptionChange ? 'Add a description...' : null)}
        </div>
      )}

      <div
        className={styles.lockedItemChart}
        style={item.chartHeightPx != null ? { height: item.chartHeightPx } : undefined}
      >
        <GridItemContext.Provider value={{ cols: 1 }}>
          {item.content}
        </GridItemContext.Provider>
      </div>
    </div>
  );
});

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
    const colIdx = Math.min(Math.floor(pos.x / colWidth + 0.5), nCols - 1);
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
 * A self-contained widget grid. Items are placed on an n-column grid; each
 * spans a whole number of columns/rows. Items can be moved (drag the header)
 * and resized (drag the right / bottom / corner handles); all changes snap to
 * grid units and are reported through `onLayoutChange`.
 *
 * All drag/drop/resize behaviour lives in {@link useGridInteraction}; this
 * component is purely presentational.
 */
function EditableSectionGrid({
  items,
  layout,
  selection: selectionProp,
  columns = GRID_COLUMNS,
  rowHeight = GRID_ROW_HEIGHT,
  gap = GRID_GAP,
  rowGap = GRID_ROW_GAP,
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
    displayHeight,
    dropHint,
    multiStack,
    zOrder,
    draggingKey,
    selection,
    startMove,
    startResize,
  } = useGridInteraction({ items, layout, columns, rowHeight, gap, rowGap, editable: true, selection: selectionProp, onLayoutChange, onItemClick });

  return (
    <div ref={containerRef} className={styles.grid} style={{ height: displayHeight }}>
      {containerWidth > 0 && items.map((item) => {
        const pos = layoutMap.get(item.key);
        if (!pos) return null;
        const width = pos.w * cellWidth + (pos.w - 1) * gap;
        const height = pos.h * rowHeight - rowGap;
        const isDragging = draggingKey === item.key;
        const isSelected = selection.isSelected(item.key);

        // Layout position; overridden below when this cell is part of an animated multi-drag stack.
        let left = pos.x * colSpan;
        let top = pos.y * rowSpan;
        let zIndex = zOrder.indexOf(item.key) + 1;
        let stacked = false;
        if (multiStack) {
          if (item.key === multiStack.primaryKey) {
            left = multiStack.left;
            top = multiStack.top;
            zIndex = 1000;
          } else {
            const i = multiStack.trailing.indexOf(item.key);
            if (i !== -1) {
              const depth = multiStack.trailing.length - i;
              left = multiStack.left + depth * STACK_OFFSET;
              top = multiStack.top + depth * STACK_OFFSET;
              zIndex = 900 - depth;
              stacked = true;
            }
          }
        }

        const className = [
          styles.item,
          isSelected ? styles.itemSelected : '',
          isDragging ? styles.itemDragging : '',
          stacked ? styles.itemStacked : '',
          dropHint?.kind === 'swap' && dropHint.targetKey === item.key ? styles.itemSwapTarget : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div key={item.key} className={className} style={{ left, top, width, height, zIndex }}>
            <div className={styles.itemHeader} onPointerDown={(e) => startMove(e, item.key)} title={item.title}>
              {item.titleNode ?? item.title}
            </div>
            <div className={styles.itemBody}>
              <GridItemContext.Provider value={{ cols: pos.w }}>
                {item.content}
              </GridItemContext.Provider>
            </div>
            <>
              <div className={styles.handle + ' ' + styles.handleRight} onPointerDown={(e) => startResize(e, item.key, 'right')} />
              <div className={styles.handle + ' ' + styles.handleBottom} onPointerDown={(e) => startResize(e, item.key, 'bottom')} />
              <div className={styles.handle + ' ' + styles.handleCorner} onPointerDown={(e) => startResize(e, item.key, 'corner')} />
            </>
          </div>
        );
      })}
      {dropHint?.kind === 'insert' && (() => {
        const l = dropHint.line;
        const style =
          l.orientation === 'vertical'
            ? { left: l.cellX * colSpan - gap / 2, top: l.cellY * rowSpan, height: l.length * rowSpan - rowGap }
            : { left: l.cellX * colSpan, top: l.cellY * rowSpan - rowGap / 2, width: l.length * colSpan - gap };
        return (
          <div
            className={`${styles.insertLine} ${l.orientation === 'vertical' ? styles.insertLineV : styles.insertLineH}`}
            style={style}
          />
        );
      })()}
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
