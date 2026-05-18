import { FC, useState, useMemo, useCallback, useEffect } from 'react';
import { type CohortClassified } from '../../types';
import styles from './ModalLegend.module.css';

interface ModalLegendProps {
  cohortData: CohortClassified[];
  visible: Set<number>;
  onToggle: (index: number) => void;
}

export const ModalLegend: FC<ModalLegendProps> = ({ cohortData, visible, onToggle }) => (
  <div className={styles.legend}>
    {cohortData.map((cd, i) => (
      <button
        key={cd.name}
        className={`${styles.btn} ${visible.has(i) ? '' : styles.btnOff}`}
        style={{ '--cohort-color': cd.color } as React.CSSProperties}
        onClick={() => onToggle(i)}
      >
        <span
          className={styles.swatch}
          style={{ background: visible.has(i) ? cd.color : 'transparent' }}
        />
        {cd.name}
      </button>
    ))}
  </div>
);

/** Hook that pairs with ModalLegend for cohort visibility toggling. */
export function useCohortVisibility(count: number) {
  const [visible, setVisible] = useState<Set<number>>(() => new Set(Array.from({ length: count }, (_, i) => i)));

  // When count grows, add new indices so newly added cohorts are visible
  useEffect(() => {
    setVisible((prev) => {
      if (count <= prev.size && [...prev].every((i) => i < count)) return prev;
      const next = new Set(prev);
      for (let i = 0; i < count; i++) {
        if (!next.has(i)) next.add(i);
      }
      return next;
    });
  }, [count]);

  const toggle = useCallback((i: number) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  return { visible, toggle };
}

export function useFilteredCohortData(cohortData: CohortClassified[], visible: Set<number>) {
  return useMemo(() => cohortData.filter((_, i) => visible.has(i)), [cohortData, visible]);
}
