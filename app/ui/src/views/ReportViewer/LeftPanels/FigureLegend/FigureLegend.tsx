import { FC, useState, useCallback, useRef } from 'react';
import { LegendDot } from '../CohortSelector/LegendDot';
import { SimpleCustomScrollbar } from '../../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { getCohortColor, type LegendSelection, type CohortDescriptions } from '../../types';
import styles from './FigureLegend.module.css';

interface FigureLegendProps {
  selections: LegendSelection[];
  onReorder: (selections: LegendSelection[]) => void;
  cohortDescriptions?: CohortDescriptions;
}

function getLabel(sel: LegendSelection, cohortDescriptions?: CohortDescriptions): string {
  const dn = cohortDescriptions?.[sel.cohortName]?.display_name;
  if (dn) return dn;
  const idx = sel.cohortName.indexOf('__');
  return idx === -1 ? 'Main Cohort' : sel.cohortName.substring(idx + 2);
}

export const FigureLegend: FC<FigureLegendProps> = ({ selections, onReorder, cohortDescriptions }) => {
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
      const next = [...selections];
      const [moved] = next.splice(from, 1);
      next.splice(insertAt, 0, moved);
      onReorder(next);
    },
    [selections, onReorder, getDropLineIndex],
  );

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDropLineIndex(null);
  }, []);

  if (selections.length === 0) {
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
            {selections.map((sel, i) => {
              const color = getCohortColor(sel.groupIndex, sel.subIndex, sel.totalSubs);
              const label = getLabel(sel, cohortDescriptions);
              const isDragging = dragIndexRef.current === i;
              return (
                <div key={sel.cohortName} className={styles.rowWrapper}>
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
                    <span className={styles.dragHandle} aria-hidden>
                      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                        <circle cx="3" cy="2.5" r="1.2" /><circle cx="7" cy="2.5" r="1.2" />
                        <circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
                        <circle cx="3" cy="11.5" r="1.2" /><circle cx="7" cy="11.5" r="1.2" />
                      </svg>
                    </span>
                  </div>
                </div>
              );
            })}
            {dropLineIndex === selections.length && <div className={styles.dropLine} />}
          </div>
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
