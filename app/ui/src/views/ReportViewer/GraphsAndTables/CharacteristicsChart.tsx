import { FC, useCallback, useMemo } from 'react';
import {
  type CohortClassified,
  type KdeCurve,
} from '../types';
import { type SequentialRow, groupRowsBySection } from '../studyRegistryUtils';
import { BarChartCellRenderer } from './RowRenderers/BarChartCellRenderer';
import { CategoricalBarChartCellRenderer } from './RowRenderers/CategoricalBarChartCellRenderer';
import { NumericGraphCellRenderer } from './RowRenderers/NumericGraphCellRenderer';
import { SectionCard } from './SectionCard';
import { useClickGuard } from './useClickGuard';
import styles from './CharacteristicsChart.module.css';

/* ── Main component ──────────────────────────────────────────────────── */

interface CharacteristicsChartProps {
  cohortData: CohortClassified[];
  /** Sequential rows for this reporter, already filtered from the global list */
  reporterRows: SequentialRow[];
  sectionRefs: Map<string, HTMLDivElement>;
  /** Open the HorizontalRowViewer at the given sequential index */
  onOpen: (index: number) => void;
  finalCohortSizes?: Record<string, number | null>;
}

export const CharacteristicsChart: FC<CharacteristicsChartProps> = ({
  cohortData,
  reporterRows,
  sectionRefs,
  onOpen,
  finalCohortSizes,
}) => {
  // Group this reporter's rows by section
  const groups = useMemo(() => groupRowsBySection(reporterRows), [reporterRows]);

  // Derive KDE data from cohortData
  const kdeData = useMemo(() => {
    const result: Record<string, Record<string, KdeCurve>> = {};
    for (const cd of cohortData) {
      if (cd.data.kdes) result[cd.name] = cd.data.kdes;
    }
    return result;
  }, [cohortData]);

  if (!reporterRows.length) return null;

  return (
    <div className={styles.container}>
      {groups.map((g, gi) => {
        const key = g.section ?? `_ungrouped_${gi}`;
        return (
          <SectionCard
            key={key}
            title={g.section ?? undefined}
            ref={(el) => {
              if (el) sectionRefs.set(key, el);
              else sectionRefs.delete(key);
            }}
          >
            {g.rows.map((row) => (
              <CharacteristicRow
                key={row.name}
                row={row}
                cohortData={cohortData}
                kdeData={kdeData}
                onOpen={onOpen}
                finalCohortSizes={finalCohortSizes}
              />
            ))}
          </SectionCard>
        );
      })}
    </div>
  );
};

/* ── Row dispatcher ──────────────────────────────────────────────────── */

const CharacteristicRow: FC<{
  row: SequentialRow;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  onOpen: (index: number) => void;
  finalCohortSizes?: Record<string, number | null>;
}> = ({ row, cohortData, kdeData, onOpen, finalCohortSizes }) => {
  if (row.rowType === 'categorical') {
    return <CategoricalRow row={row} cohortData={cohortData} onOpen={onOpen} finalCohortSizes={finalCohortSizes} />;
  }
  if (row.rowType === 'numeric') {
    return <NumericRow row={row} cohortData={cohortData} kdeData={kdeData} onOpen={onOpen} />;
  }
  return <BooleanRow row={row} cohortData={cohortData} onOpen={onOpen} finalCohortSizes={finalCohortSizes} />;
};

/* ── Boolean row ─────────────────────────────────────────────────────── */

const BooleanRow: FC<{ row: SequentialRow; cohortData: CohortClassified[]; onOpen: (index: number) => void; finalCohortSizes?: Record<string, number | null> }> = ({
  row,
  cohortData,
  onOpen,
  finalCohortSizes,
}) => {
  const handler = useCallback(() => onOpen(row.index), [row.index, onOpen]);
  const { onMouseDown, onClick } = useClickGuard(handler);

  return (
    <div className={styles.row} onMouseDown={onMouseDown} onClick={onClick} style={{ cursor: 'pointer' }} data-row-name={row.name}>
      <span className={styles.rowTooltip}>click to open</span>
      <div className={styles.nameCell}>{row.registry?.display_name || row.name}</div>
      <div className={styles.booleanChartCell}>
        <BarChartCellRenderer data={{ name: row.name, _meta: { cohortData, finalCohortSizes } }} isModal />
      </div>
    </div>
  );
};

/* ── Categorical row (each category as a sub-row) ────────────────────── */

const CategoricalRow: FC<{
  row: SequentialRow;
  cohortData: CohortClassified[];
  onOpen: (index: number) => void;
  finalCohortSizes?: Record<string, number | null>;
}> = ({ row, cohortData, onOpen, finalCohortSizes }) => {
  const handler = useCallback(() => onOpen(row.index), [row.index, onOpen]);
  const { onMouseDown, onClick } = useClickGuard(handler);

  return (
    <div className={styles.numericRow} onMouseDown={onMouseDown} onClick={onClick} style={{ cursor: 'pointer' }} data-row-name={row.name}>
      <span className={styles.rowTooltip}>click to open</span>
      <div className={`${styles.nameCell} ${styles.numericNameCell}`}>{row.registry?.display_name || row.name}</div>
      <div className={styles.kdeCell}>
        <CategoricalBarChartCellRenderer
          baseName={row.name}
          cohortData={cohortData}
          finalCohortSizes={finalCohortSizes}
          orientation="vertical"
        />
      </div>
    </div>
  );
};

/* ── Numeric row ─────────────────────────────────────────────────────── */

const NumericRow: FC<{
  row: SequentialRow;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  onOpen: (index: number) => void;
}> = ({ row, cohortData, kdeData, onOpen }) => {
  const handler = useCallback(() => onOpen(row.index), [row.index, onOpen]);
  const { onMouseDown, onClick } = useClickGuard(handler);

  return (
    <div className={styles.numericRow} onMouseDown={onMouseDown} onClick={onClick} style={{ cursor: 'pointer' }} data-row-name={row.name}>
      <span className={styles.rowTooltip}>click to open</span>
      <div className={`${styles.nameCell} ${styles.numericNameCell}`}>{row.registry?.display_name || row.name}</div>
      <div className={styles.kdeCell}>
        <NumericGraphCellRenderer name={row.name} cohortData={cohortData} kdeData={kdeData} />
      </div>
    </div>
  );
};