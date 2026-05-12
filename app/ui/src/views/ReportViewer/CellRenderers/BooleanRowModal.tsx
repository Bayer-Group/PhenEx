import { FC, useState, useMemo, useCallback } from 'react';
import { type CohortClassified } from '../types';
import { RowModal } from './RowModal';
import { BarChartCellRenderer } from './BarChartCellRenderer';
import styles from './BooleanRowModal.module.css';

interface BooleanRowModalProps {
  name: string;
  cohortData: CohortClassified[];
  onClose: () => void;
}

export const BooleanRowModal: FC<BooleanRowModalProps> = ({
  name,
  cohortData,
  onClose,
}) => {
  const [visible, setVisible] = useState<Set<number>>(
    () => new Set(cohortData.map((_, i) => i)),
  );

  const toggleCohort = useCallback((i: number) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }, []);

  const filteredCohortData = useMemo(
    () => cohortData.filter((_, i) => visible.has(i)),
    [cohortData, visible],
  );

  return (
    <RowModal onClose={onClose}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.title}>{name}</div>
          <div className={styles.legend}>
            {cohortData.map((cd, i) => (
              <button
                key={cd.name}
                className={`${styles.legendBtn} ${visible.has(i) ? '' : styles.legendBtnOff}`}
                style={{ '--cohort-color': cd.color } as React.CSSProperties}
                onClick={() => toggleCohort(i)}
              >
                <span
                  className={styles.legendSwatch}
                  style={{ background: visible.has(i) ? cd.color : 'transparent' }}
                />
                {cd.name}
              </button>
            ))}
          </div>
        </div>
        <BarChartCellRenderer
          data={{ name, _meta: { cohortData: filteredCohortData } }}
          isModal
        />
      </div>
    </RowModal>
  );
};
