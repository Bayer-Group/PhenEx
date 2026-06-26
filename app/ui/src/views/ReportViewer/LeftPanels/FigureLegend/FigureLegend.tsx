import { FC, useState, useCallback, useRef } from 'react';
import { LegendDot } from '../CohortSelector/LegendDot';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import {
  getCohortColor,
  isSpacer,
  SPACER_SIZES,
  type LegendItem,
  type LegendSelection,
  type LegendSpacer,
  type CohortDescriptions,
} from '../../types';
import styles from './FigureLegend.module.css';

interface FigureLegendProps {
  items: LegendItem[];
  onChange: (items: LegendItem[]) => void;
  cohortDescriptions?: CohortDescriptions;
}

function getLabel(sel: LegendSelection, cohortDescriptions?: CohortDescriptions): string {
  const dn = cohortDescriptions?.[sel.cohortName]?.display_name;
  if (dn) return dn;
  const idx = sel.cohortName.indexOf('__');
  return idx === -1 ? 'Main Cohort' : sel.cohortName.substring(idx + 2);
}

function makeSpacerId(): string {
  return `spacer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const FigureLegend: FC<FigureLegendProps> = ({ items, onChange, cohortDescriptions }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  // dropLineIndex: the gap index where the line will appear.
  // 0 = before item 0, 1 = before item 1, ..., n = after last item.
  const [dropLineIndex, setDropLineIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);

  const getDropLineIndex = useCallback((e: React.DragEvent, rowIndex: number): number => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    return e.clientY < midY ? rowIndex : rowIndex + 1;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, rowIndex: number) => {
    e.preventDefault();
    setDropLineIndex(getDropLineIndex(e, rowIndex));
  }, [getDropLineIndex]);

  const handleDrop = useCallback(
    (e: React.DragEvent, rowIndex: number) => {
      e.preventDefault();
      const from = dragIndexRef.current;
      const lineIndex = getDropLineIndex(e, rowIndex);
      dragIndexRef.current = null;
      setDropLineIndex(null);
      if (from == null) return;
      // Resolve insertion index accounting for the removal of `from`
      const insertAt = lineIndex > from ? lineIndex - 1 : lineIndex;
      if (insertAt === from) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(insertAt, 0, moved);
      onChange(next);
    },
    [items, onChange, getDropLineIndex],
  );

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDropLineIndex(null);
  }, []);

  const handleAddSpacer = useCallback(() => {
    const spacer: LegendSpacer = { kind: 'spacer', id: makeSpacerId(), size: 1 };
    onChange([...items, spacer]);
  }, [items, onChange]);

  const handleSetSpacerSize = useCallback(
    (index: number, size: 1 | 2 | 3 | 4) => {
      const next = items.map((it, i) =>
        i === index && isSpacer(it) ? { ...it, size } : it,
      );
      onChange(next);
    },
    [items, onChange],
  );

  const handleSetSpacerLabel = useCallback(
    (index: number, label: string) => {
      const next = items.map((it, i) =>
        i === index && isSpacer(it) ? { ...it, label } : it,
      );
      onChange(next);
    },
    [items, onChange],
  );

  const handleRemoveSpacer = useCallback(
    (index: number) => {
      onChange(items.filter((_, i) => i !== index));
    },
    [items, onChange],
  );

  const cohortCount = items.filter((it) => !isSpacer(it)).length;

  if (cohortCount === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>No cohorts selected. Select cohorts in the Cohorts tab.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.scrollRegion}>
        <div ref={scrollRef} className={styles.scrollContent}>
          <div className={styles.hint}>Drag to reorder</div>
          <div className={styles.card}>
            {items.map((item, i) => {
              const dragHandle = (
                <span className={styles.dragHandle} aria-hidden>
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                    <circle cx="3" cy="2.5" r="1.2" /><circle cx="7" cy="2.5" r="1.2" />
                    <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
                    <circle cx="3" cy="11.5" r="1.2" /><circle cx="7" cy="11.5" r="1.2" />
                  </svg>
                </span>
              );

              if (isSpacer(item)) {
                return (
                  <div key={item.id} className={styles.rowWrapper}>
                    {dropLineIndex === i && <div className={styles.dropLine} />}
                    <div
                      className={styles.spacerRow}
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDrop={(e) => handleDrop(e, i)}
                      onDragEnd={handleDragEnd}
                    >
                      <input
                        className={styles.spacerLabelInput}
                        value={item.label ?? ''}
                        placeholder="Spacer label"
                        onChange={(e) => handleSetSpacerLabel(i, e.target.value)}
                        // Prevent the parent row's drag from hijacking text selection.
                        draggable={false}
                        onDragStart={(e) => e.preventDefault()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                      <div className={styles.spacerSizes}>
                        {SPACER_SIZES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className={`${styles.spacerSizeButton} ${item.size === s ? styles.spacerSizeButtonActive : ''}`}
                            onClick={() => handleSetSpacerSize(i, s)}
                            title={`Spacing ${s}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={styles.spacerRemove}
                        onClick={() => handleRemoveSpacer(i)}
                        title="Remove spacer"
                        aria-label="Remove spacer"
                      >
                        ×
                      </button>
                      {dragHandle}
                    </div>
                  </div>
                );
              }

              const color = getCohortColor(item.groupIndex, item.subIndex, item.totalSubs);
              const label = getLabel(item, cohortDescriptions);
              const isDragging = dragIndexRef.current === i;
              return (
                <div key={item.cohortName} className={styles.rowWrapper}>
                  {dropLineIndex === i && <div className={styles.dropLine} />}
                  <div
                    className={`${styles.row} ${isDragging ? styles.rowDragging : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDrop={(e) => handleDrop(e, i)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className={styles.dot}>
                      <LegendDot color={color} isActive onClick={() => {}} />
                    </div>
                    <span className={styles.label}>{label}</span>
                    {dragHandle}
                  </div>
                </div>
              );
            })}
            {dropLineIndex === items.length && <div className={styles.dropLine} />}
          </div>
          <button type="button" className={styles.addSpacerButton} onClick={handleAddSpacer}>
            + Add spacer
          </button>
        </div>
        <div className={styles.scrollbarRegion}>
          <SimpleCustomScrollbar
            targetRef={scrollRef}
            orientation="vertical"
            marginTop={10}
            marginBottom={10}
            marginToEnd={10}
            classNameTrack={styles.scrollBarTrack}
            classNameThumb={styles.scrollBarThumb}
            showOnHover={true}
          />
        </div>
      </div>
    </div>
  );
};
