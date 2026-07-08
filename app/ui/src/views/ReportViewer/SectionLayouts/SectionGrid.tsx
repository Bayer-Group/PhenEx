import { ReactNode } from 'react';
import { type GridItem, GRID_COLUMNS, GRID_ROW_HEIGHT, GRID_GAP, GRID_ROW_GAP } from './sectionLayoutStore';
import { GridItemContext } from './GridItemContext';
import { useGridInteraction, STACK_OFFSET } from './useGridInteraction';
import styles from './SectionGrid.module.css';

export interface SectionGridRenderItem {
  key: string;
  title: string;
  /** Optional rich title (e.g. editable) rendered in place of `title`. */
  titleNode?: ReactNode;
  content: ReactNode;
}

export interface SectionGridProps {
  items: SectionGridRenderItem[];
  layout: GridItem[];
  columns?: number;
  rowHeight?: number;
  gap?: number;
  rowGap?: number;
  editable?: boolean;
  onLayoutChange: (items: GridItem[]) => void;
  onItemClick?: (key: string) => void;
}

/**
 * A self-contained widget grid. Items are placed on an n-column grid; each
 * spans a whole number of columns/rows. Items can be moved (drag the header)
 * and resized (drag the right / bottom / corner handles); all changes snap to
 * grid units and are reported through `onLayoutChange`.
 *
 * All drag/drop/resize behaviour lives in {@link useGridInteraction}; this
 * component is purely presentational.
 */
export function SectionGrid({
  items,
  layout,
  columns = GRID_COLUMNS,
  rowHeight = GRID_ROW_HEIGHT,
  gap = GRID_GAP,
  rowGap = GRID_ROW_GAP,
  editable = true,
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
  } = useGridInteraction({ items, layout, columns, rowHeight, gap, rowGap, editable, onLayoutChange, onItemClick });

  return (
    <div ref={containerRef} className={styles.grid} style={{ height: displayHeight }}>
      {containerWidth > 0 && items.map((item) => {
        const pos = layoutMap.get(item.key);
        if (!pos) return null;
        const width = pos.w * cellWidth + (pos.w - 1) * gap;
        const height = pos.h * rowHeight - rowGap;
        const isDragging = draggingKey === item.key;
        const isSelected = selection.isSelected(item.key);

        // Layout position; overridden below when this cell is part of an
        // animated multi-drag stack.
        let left = pos.x * colSpan;
        let top = pos.y * rowSpan;
        let zIndex = zOrder.indexOf(item.key) + 1;
        let stacked = false;
        if (multiStack) {
          if (item.key === multiStack.primaryKey) {
            left = multiStack.left;
            top = multiStack.top;
            zIndex = 1000; // primary rides on top of the stack
          } else {
            const i = multiStack.trailing.indexOf(item.key);
            if (i !== -1) {
              const depth = multiStack.trailing.length - i; // deeper = further back
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
          <div
            key={item.key}
            className={className}
            style={{ left, top, width, height, zIndex }}
          >
            <div
              className={styles.itemHeader}
              onPointerDown={(e) => startMove(e, item.key)}
              title={item.title}
            >
              {item.titleNode ?? item.title}
            </div>
            <div className={styles.itemBody}>
              <GridItemContext.Provider value={{ cols: pos.w }}>
                {item.content}
              </GridItemContext.Provider>
            </div>
            {editable && (
              <>
                <div className={styles.handle + ' ' + styles.handleRight} onPointerDown={(e) => startResize(e, item.key, 'right')} />
                <div className={styles.handle + ' ' + styles.handleBottom} onPointerDown={(e) => startResize(e, item.key, 'bottom')} />
                <div className={styles.handle + ' ' + styles.handleCorner} onPointerDown={(e) => startResize(e, item.key, 'corner')} />
              </>
            )}
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
