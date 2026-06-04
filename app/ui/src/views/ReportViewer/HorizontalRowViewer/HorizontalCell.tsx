import { FC, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type CohortClassified, type KdeCurve } from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { useCohortVisibility, useFilteredCohortData } from '../GraphsAndTables/ModalRenderers/ModalLegend';
import { BarChartCellRenderer } from '../GraphsAndTables/RowRenderers/BarChartCellRenderer';
import { CategoricalBarChartCellRenderer } from '../GraphsAndTables/RowRenderers/CategoricalBarChartCellRenderer';
import { NumericContent } from '../GraphsAndTables/ModalRenderers/NumericContent';
import { TimeToEventContent } from '../GraphsAndTables/ModalRenderers/TimeToEventContent';
import { Table2Content } from '../GraphsAndTables/ModalRenderers/Table2Content';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { StudyInfoCellRenderer } from '../GraphsAndTables/RowRenderers/StudyInfoCellRenderer';
import { CommentCard } from './CommentCard';

import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';
import { useThreePanelCollapse } from '../../../contexts/ThreePanelCollapseContext';
import { CardWithCommentsPanel } from './CardWithCommentsPanel';
import booleanStyles from '../GraphsAndTables/ModalRenderers/BooleanRowModal.module.css';
import categoricalStyles from '../GraphsAndTables/ModalRenderers/CategoricalRowModal.module.css';
import styles from './HorizontalCell.module.css';

// ── Props ───────────────────────────────────────────────────────────────

export interface HorizontalCellProps {
  row: SequentialRow;
  rows: SequentialRow[];
  isFocused: boolean;
  nearby: boolean;
  desiredTop: string;
  cohortDataMap: Record<string, CohortClassified[]>;
  finalCohortSizes?: Record<string, number | null>;
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  onNavigate: (index: number) => void;
  onVerticalScroll?: (scrollTop: number, threshold: number) => void;
  initialScrollTop?: number;
  commentsCollapsed?: boolean;
  commentsPanelWidth: number;
  onCommentsPanelWidthChange: (width: number) => void;
  studyTitle?: string;
  studyDescription?: string;
}

// ── CardInfoSection ─────────────────────────────────────────────────────

const CardInfoSection: FC<{ row: SequentialRow }> = () => {
  return <div className={styles.cardInfoSection} />;
};

// ── RowContent dispatcher ───────────────────────────────────────────────

const RowContent: FC<{
  row: SequentialRow;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  finalCohortSizes?: Record<string, number | null>;
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  availableTteOutcomes?: string[];
  showCohortInfo?: boolean;
  studyTitle?: string;
  studyDescription?: string;
}> = ({ row, cohortData, kdeData, finalCohortSizes, tteCohorts, table2Cohorts, availableTteOutcomes, showCohortInfo = true, studyTitle, studyDescription }) => {
  switch (row.rowType) {
    case 'boolean':
      return <BooleanContent name={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes} showCohortInfo={showCohortInfo} />;
    case 'categorical':
      return <CategoricalContent baseName={row.name} cohortData={cohortData} finalCohortSizes={finalCohortSizes} />;
    case 'numeric':
      return <NumericContent name={row.name} cohortData={cohortData} kdeData={kdeData} finalCohortSizes={finalCohortSizes} />;
    case 'time_to_event':
      return <TimeToEventContent outcome={row.name} cohorts={tteCohorts ?? []} availableOutcomes={availableTteOutcomes} />;
    case 'table2':
      return <Table2Content outcome={row.name} cohorts={table2Cohorts ?? []} />;
    case 'study_info':
      return <StudyInfoContent title={studyTitle ?? ''} description={studyDescription} />;
    default:
      return <div style={{ padding: 20, color: '#999' }}>No detail view for {row.rowType} rows yet.</div>;
  }
};

// ── StudyInfoContent ────────────────────────────────────────────────────

const StudyInfoContent: FC<{ title: string; description?: string }> = ({ title, description }) => {
  return <StudyInfoCellRenderer title={title} description={description} />;
};

// ── BooleanContent ──────────────────────────────────────────────────────

const BooleanContent: FC<{ name: string; cohortData: CohortClassified[]; finalCohortSizes?: Record<string, number | null>; showCohortInfo?: boolean }> = ({ name, cohortData, finalCohortSizes, showCohortInfo = true }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  return (
    <div className={booleanStyles.container}>
      <BarChartCellRenderer
        data={{ name, _meta: { cohortData: filtered, finalCohortSizes } }}
        isModal
        mode={showCohortInfo ? 'presentation' : 'compact'}
        pctDecimals={1}
      />
    </div>
  );
};

// ── CategoricalContent ──────────────────────────────────────────────────

const CategoricalContent: FC<{ baseName: string; cohortData: CohortClassified[]; finalCohortSizes?: Record<string, number | null> }> = ({ baseName, cohortData, finalCohortSizes }) => {
  const { visible } = useCohortVisibility(cohortData.length);
  const filtered = useFilteredCohortData(cohortData, visible);

  return (
    <div className={categoricalStyles.container}>
      <CategoricalBarChartCellRenderer
        baseName={baseName}
        cohortData={filtered}
        finalCohortSizes={finalCohortSizes}
        orientation="vertical"
      />
    </div>
  );
};

// ── HorizontalCell ──────────────────────────────────────────────────────

export const HorizontalCell = forwardRef<HTMLDivElement, HorizontalCellProps>(
  ({ row, rows, isFocused, nearby, desiredTop, cohortDataMap, finalCohortSizes, tteCohorts, table2Cohorts, onNavigate, onVerticalScroll, initialScrollTop, commentsCollapsed, commentsPanelWidth, onCommentsPanelWidthChange, studyTitle = '', studyDescription }, ref) => {
    const cohortData = cohortDataMap[row.reporter] ?? [];
    const { isLeftPanelShown } = useThreePanelCollapse();
    const verticalScrollRef = useRef<HTMLDivElement>(null);
    const [titleHidden, setTitleHidden] = useState(false);
    const initialScrollTopRef = useRef(initialScrollTop ?? 0);
    initialScrollTopRef.current = initialScrollTop ?? 0;
    const handleRightWidthChange = useCallback((w: number) => {
      onCommentsPanelWidthChange(w);
    }, [onCommentsPanelWidthChange]);

    useEffect(() => {
      const el = verticalScrollRef.current;
      if (!el || !isFocused) return;
      el.scrollTop = initialScrollTopRef.current;
      const threshold = 10;
      const handler = () => {
        const hidden = el.scrollTop > threshold;
        setTitleHidden(hidden);
        onVerticalScroll?.(el.scrollTop, threshold);
      };
      el.addEventListener('scroll', handler, { passive: true });
      handler();
      return () => el.removeEventListener('scroll', handler);
    }, [isFocused, onVerticalScroll]);
    const availableTteOutcomes = useMemo(
      () => rows
        .filter((c) => c.reporter === row.reporter && c.rowType === 'time_to_event')
        .map((c) => c.name),
      [rows, row.reporter],
    );
    const kdeData = useMemo(() => {
      const result: Record<string, Record<string, KdeCurve>> = {};
      for (const cd of cohortData) {
        if (cd.data.kdes) result[cd.name] = cd.data.kdes;
      }
      return result;
    }, [cohortData]);

    const comments = useMemo(() => (row.registry?.comments ?? []).filter((c) => c.text), [row.registry]);

    const mainContent = (
      <div className={styles.cardBody}>
        <div className={styles.contentCard} style={{ marginRight: commentsCollapsed ? 0 : 25, borderRadius: commentsCollapsed ? 0 : '0 10px 10px 0px' }}>
          <div className={styles.cardTitle} style={{ opacity: titleHidden ? 0 : 1 }}>
            {row.registry?.display_name || row.name}
          </div>
          <CardInfoSection row={row} />
          <div className={styles.cardContent} style={{ marginRight: commentsCollapsed ? "10%" : 25 }}>
            {nearby ? <RowContent row={row} cohortData={cohortData} kdeData={kdeData} finalCohortSizes={finalCohortSizes} tteCohorts={tteCohorts} table2Cohorts={table2Cohorts} availableTteOutcomes={availableTteOutcomes} showCohortInfo studyTitle={studyTitle} studyDescription={studyDescription} /> : null}
          </div>
        </div>
      </div>
    );

    const commentsContent = (
      <div className={styles.inlineComments}>
        {comments.map((comment, i) => (
          <CommentCard key={i} comment={comment} />
        ))}
      </div>
    );

    return (
      <div
        ref={ref}
        className={styles.cell}
        style={{ '--desired-top': desiredTop, paddingLeft: isLeftPanelShown ? undefined : 100 } as React.CSSProperties}
      >
      <div className={styles.topGradient} />

        <div className={styles.cardColumnInner}>
          <div ref={verticalScrollRef} className={styles.verticalWrapper}>
            <div
              className={`${styles.card} ${isFocused ? styles.cardFocused : styles.cardNeighbour}`}
              onClick={(e) => { e.stopPropagation(); if (!isFocused) onNavigate(row.index); }}
            >
                <CardWithCommentsPanel
                  initialSizeLeft={500}
                  minSizeLeft={300}
                  minSizeRight={300}
                  maxSizeRight={500}
                  rightWidth={commentsPanelWidth}
                  leftContent={mainContent}
                  commentsContent={commentsContent}
                  onRightWidthChange={handleRightWidthChange}
                  commentsCollapsed={commentsCollapsed}
                />
            </div>
          </div>
          <SimpleCustomScrollbar
            targetRef={verticalScrollRef}
            orientation="vertical"
            marginTop={100}
            marginBottom={35}
            marginToEnd={commentsCollapsed ? 10 : commentsPanelWidth - 1}
            classNameThumb={styles.verticalScrollbarThumb}
            classNameTrack={styles.verticalScrollbarTrack}
          />
        </div>
      </div>
    );
  },
);
