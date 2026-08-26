import { memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { type CohortClassified, type CohortGroup, type CohortDescriptions, type ColorOverrides } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow, type ViewerEntry, rowKey } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { HorizontalRowViewer } from './HorizontalRowViewer';
import styles from './SingleRowContentHorizontalRowViewer.module.css';

// ── Props ───────────────────────────────────────────────────────────────

interface SingleRowContentHorizontalRowViewerProps {
  /** The rows of a single section, in display order. */
  rows: SequentialRow[];
  /** Index (within `rows`) of the row to open on. */
  initialIndex: number;
  /** Flat sequential rows, used for cross-row lookups (e.g. TTE outcomes). */
  allRows: SequentialRow[];
  onClose: () => void;
  cohortDataMap: Record<string, CohortClassified[]>;
  finalCohortSizes?: Record<string, number | null>;
  spacers?: BarChartSpacer[];
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  waterfallData: Record<string, unknown>;
  groups: CohortGroup[];
  cohortDescriptions?: CohortDescriptions;
  colorOverrides?: ColorOverrides;
  onSetColor?: (cohortName: string, color: string) => void;
}

// ── Component ───────────────────────────────────────────────────────────

/**
 * A modal that scrolls horizontally through the individual rows of a single
 * section, rendering each row's detailed content. It reuses
 * {@link HorizontalRowViewer} by feeding it a list of `row` entries, so all the
 * scroll / keyboard / virtualization behaviour is shared.
 */
export const SingleRowContentHorizontalRowViewer = memo<SingleRowContentHorizontalRowViewerProps>(({
  rows,
  initialIndex,
  allRows,
  onClose,
  cohortDataMap,
  finalCohortSizes,
  spacers,
  tteCohorts,
  table2Cohorts,
  waterfallData,
  groups,
  cohortDescriptions,
  colorOverrides,
  onSetColor,
}) => {
  const entries = useMemo<ViewerEntry[]>(
    () => rows.map((row, index) => ({ kind: 'row', index, key: rowKey(row), row })),
    [rows],
  );

  if (entries.length === 0) return null;

  return createPortal(
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <HorizontalRowViewer
          entries={entries}
          rows={allRows}
          initialIndex={Math.max(0, Math.min(initialIndex, entries.length - 1))}
          onClose={onClose}
          cohortDataMap={cohortDataMap}
          finalCohortSizes={finalCohortSizes}
          spacers={spacers}
          tteCohorts={tteCohorts}
          table2Cohorts={table2Cohorts}
          waterfallData={waterfallData}
          groups={groups}
          cohortDescriptions={cohortDescriptions}
          colorOverrides={colorOverrides}
          onSetColor={onSetColor}
        />
      </div>
    </div>,
    document.body,
  );
});
