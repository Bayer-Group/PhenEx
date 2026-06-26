import { FC, useState, useCallback, useRef } from 'react';
import { LegendDot } from '../CohortSelector/LegendDot';
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
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragIndexRef.current = index;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndexRef.current !== index) setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      e.preventDefault();
      const from = dragIndexRef.current;
      dragIndexRef.current = null;
      setDragOverIndex(null);
      if (from == null || from === dropIndex) return;
      const next = [...selections];
      const [moved] = next.splice(from, 1);
      next.splice(dropIndex, 0, moved);
      onReorder(next);
    },
    [selections, onReorder],
  );

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
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
      <div className={styles.hint}>Drag to reorder</div>
      <div className={styles.card}>
        {selections.map((sel, i) => {
          const color = getCohortColor(sel.groupIndex, sel.subIndex, sel.totalSubs);
          const label = getLabel(sel, cohortDescriptions);
          const isDragOver = dragOverIndex === i;
          return (
            <div
              key={sel.cohortName}
              className={`${styles.row} ${isDragOver ? styles.rowDragOver : ''}`}
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
          );
        })}
      </div>
    </div>
  );
};
