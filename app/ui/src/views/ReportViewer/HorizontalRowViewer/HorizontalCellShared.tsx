import { FC, useMemo, useRef } from 'react';
import { type CohortClassified, type KdeCurve } from '../types';
import { type SequentialRow, type RegistryComment } from '../studyRegistryUtils';
import { useCohortVisibility, useFilteredCohortData } from '../GraphsAndTables/ModalRenderers/ModalLegend';
import { BarChartCellRenderer } from '../GraphsAndTables/RowRenderers/BarChartCellRenderer';
import { CategoricalBarChartCellRenderer } from '../GraphsAndTables/RowRenderers/CategoricalBarChartCellRenderer';
import { NumericContent } from '../GraphsAndTables/ModalRenderers/NumericContent';
import { TimeToEventContent } from '../GraphsAndTables/ModalRenderers/TimeToEventContent';
import { Table2Content } from '../GraphsAndTables/ModalRenderers/Table2Content';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import booleanStyles from '../GraphsAndTables/ModalRenderers/BooleanRowModal.module.css';
import categoricalStyles from '../GraphsAndTables/ModalRenderers/CategoricalRowModal.module.css';
import styles from './HorizontalRowViewer.module.css';
import ReactMarkdown from 'react-markdown';
import { SimpleCustomScrollbar } from '../../../components/CustomScrollbar/SimpleCustomScrollbar/SimpleCustomScrollbar';

// ── Shared props for both cell variants ─────────────────────────────────

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
  commentsOpen: boolean;
}

// ── CommentsColumn (used by Focus mode) ─────────────────────────────────

export const CommentsColumn: FC<{ comments: RegistryComment[]; isOpen: boolean }> = ({ comments, isOpen }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`${styles.commentsColumn} ${isOpen ? styles.commentsColumnOpen : ''}`}>
      <div ref={scrollRef} className={styles.commentsScroll}>
        {comments.map((comment, i) => (
          <CommentCard key={i} comment={comment} />
        ))}
        <div style={{ minHeight: 30, flexShrink: 0 }} />
      </div>
      <SimpleCustomScrollbar
        targetRef={scrollRef}
        orientation="vertical"
        marginTop={8}
        marginBottom={8}
        marginToEnd={2}
      />
    </div>
  );
};

// ── CommentCard ─────────────────────────────────────────────────────────

export const CommentCard: FC<{ comment: RegistryComment }> = ({ comment }) => {
  const label = comment.type ?? comment.user ?? '';
  const statusLabel = comment.status === 'pinned' ? '📌' : comment.status === 'resolved' ? '✓' : '';

  return (
    <div className={styles.commentCard} onClick={(e) => e.stopPropagation()}>
      <div className={styles.commentHeader}>
        <span className={styles.commentUser}>{label}</span>
        {statusLabel && <span className={styles.commentStatus}>{statusLabel}</span>}
        {comment.date && <span className={styles.commentDate}>{comment.date}</span>}
      </div>
      <div className={styles.commentBody}>
        <ReactMarkdown>{comment.text}</ReactMarkdown>
      </div>
    </div>
  );
};

// ── CardInfoSection (accordion below title, inside card) ────────────────

export const CardInfoSection: FC<{ row: SequentialRow; isOpen: boolean }> = ({ row, isOpen }) => {
  const aiComment = useMemo(() => {
    const comments = row.registry?.comments ?? [];
    return comments.find((c) => c.type === 'ai' || c.user === 'ai') ?? null;
  }, [row.registry]);

  if (!aiComment) return null;

  return (
    <div className={`${styles.cardInfoSection} ${isOpen ? styles.cardInfoSectionOpen : ''}`}>
      <div className={styles.cardInfoContent}>
        <ReactMarkdown>{aiComment.text}</ReactMarkdown>
      </div>
    </div>
  );
};

// ── RowContent dispatcher ───────────────────────────────────────────────

export const RowContent: FC<{
  row: SequentialRow;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  finalCohortSizes?: Record<string, number | null>;
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  availableTteOutcomes?: string[];
  showCohortInfo?: boolean;
}> = ({ row, cohortData, kdeData, finalCohortSizes, tteCohorts, table2Cohorts, availableTteOutcomes, showCohortInfo = true }) => {
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
    default:
      return <div style={{ padding: 20, color: '#999' }}>No detail view for {row.rowType} rows yet.</div>;
  }
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
