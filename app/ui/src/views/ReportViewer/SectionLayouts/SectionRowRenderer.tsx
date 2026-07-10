import { memo, useEffect, useRef, useState } from 'react';
import { type CohortClassified } from '../types';
import { type BarChartSpacer } from '../GraphsAndTables/RowRenderers/barChartShared';
import { type SequentialRow } from '../studyRegistryUtils';
import { type TimeToEventCohort, type Table2Cohort } from '../GraphsAndTables/OutcomesChart';
import { RightClickMenu, type RightClickMenuItem } from '../../../components/RightClickMenu/RightClickMenu';
import titleStyles from './SectionRowTitle.module.css';
import { BarChartCellRendererCompact } from '../GraphsAndTables/RowRenderers/BarChartCellRendererCompact';
import { CategoricalBarChartCellRenderer } from '../GraphsAndTables/RowRenderers/CategoricalBarChartCellRenderer';
import { BoxPlotCellRenderer } from '../GraphsAndTables/RowRenderers/BoxPlotCellRenderer';
import { NumericTableCellRenderer } from '../GraphsAndTables/RowRenderers/NumericTableCellRenderer';
import { KaplanMeierCellRenderer } from '../GraphsAndTables/RowRenderers/KaplanMeierCellRenderer';
import { Table2CellRenderer } from '../GraphsAndTables/RowRenderers/Table2CellRenderer';

// ── Props ────────────────────────────────────────────────────────────────

export interface SectionRowRendererProps {
  row: SequentialRow;
  cohortData: CohortClassified[];
  finalCohortSizes?: Record<string, number | null>;
  spacers?: BarChartSpacer[];
  tteCohorts?: TimeToEventCohort[];
  table2Cohorts?: Table2Cohort[];
  /** Suppress the bar-chart header (e.g. consecutive boolean rows in a list). */
  hideBarChartHeader?: boolean;
  /** Bars expand to fill grid item height; body scrolls on overflow (grid context). */
  fillHeight?: boolean;
  /** Chart display variant id (see rowVariants); falls back to the default. */
  variant?: string;
}

/**
 * Renders the chart/graph content for a single section row using the same
 * compact renderers regardless of whether the row is shown in the list view or
 * the grid view. This is the shared surface both section views build on.
 */
export const SectionRowRenderer = memo<SectionRowRendererProps>(({
  row,
  cohortData,
  finalCohortSizes,
  spacers,
  tteCohorts,
  table2Cohorts,
  hideBarChartHeader = false,
  fillHeight = false,
  variant,
}) => {
  switch (row.rowType) {
    case 'boolean':
      return (
        <BarChartCellRendererCompact
          data={{ name: row.name, _meta: { cohortData, finalCohortSizes, spacers } }}
          isModal
          hideHeader={hideBarChartHeader}
          fillHeight={fillHeight}
        />
      );
    case 'categorical':
      return (
        <CategoricalBarChartCellRenderer
          baseName={row.name}
          cohortData={cohortData}
          finalCohortSizes={finalCohortSizes}
          orientation={variant === 'horizontal' ? 'horizontal' : 'vertical'}
          fillWidth={fillHeight}
        />
      );
    case 'numeric': {
      if (variant === 'table') {
        return (
          <NumericTableCellRenderer
            name={row.name}
            cohortData={cohortData}
            finalCohortSizes={finalCohortSizes}
          />
        );
      }
      let lo = Infinity, hi = -Infinity;
      for (const cd of cohortData) {
        const r = cd.data.rows.find((r) => r.Name === row.name);
        if (!r) continue;
        if (r.Min != null && r.Min < lo) lo = r.Min;
        if (r.Max != null && r.Max > hi) hi = r.Max;
      }
      if (!isFinite(lo)) { lo = 0; hi = 1; }
      return <BoxPlotCellRenderer name={row.name} cohortData={cohortData} xMin={lo} xMax={hi} spacers={spacers} fillWidth={fillHeight} />;
    }
    case 'time_to_event': {
      const kmCurves = (tteCohorts ?? [])
        .map((c) => ({
          color: c.color,
          cohortName: c.name,
          steps: c.timeToEvent.filter((r) => r.Outcome === row.name),
        }))
        .filter((c) => c.steps.length > 0);
      return <KaplanMeierCellRenderer curves={kmCurves} mode="compact" />;
    }
    case 'table2': {
      const t2cohorts = (table2Cohorts ?? []).map((c) => ({
        name: c.name,
        color: c.color,
        table2: c.table2,
      }));
      return <Table2CellRenderer outcome={row.name} cohorts={t2cohorts} />;
    }
    default:
      return null;
  }
});

/** Human-readable label for a section row. */
export function sectionRowTitle(row: SequentialRow): string {
  return row.displayName || row.registry?.display_name || row.name;
}

// ── Editable title ─────────────────────────────────────────────────────────

export interface SectionRowTitleProps {
  row: SequentialRow;
  /** Styling for the title container (list cell / grid header). */
  className?: string;
  /** Commit a new editable display label for the phenotype. */
  onRename?: (name: string, displayName: string) => void;
  /** Open the phenotype in the single-row modal. */
  onOpen?: (row: SequentialRow) => void;
}

/**
 * The single, shared title used by both the list and grid section views.
 * Behaves identically to the outline items: double-click starts an inline
 * rename, right-click opens a menu whose primary action opens the modal. All
 * interactions stop propagation so they never trigger the surrounding card's
 * navigate/drag handlers.
 */
export const SectionRowTitle = memo<SectionRowTitleProps>(({ row, className, onRename, onOpen }) => {
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const label = sectionRowTitle(row);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const next = inputRef.current?.value.trim() ?? '';
    if (next && next !== label) onRename?.(row.name, next);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={titleStyles.input}
        defaultValue={label}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
        }}
        onBlur={commit}
      />
    );
  }

  const menuItems: RightClickMenuItem[] = [
    ...(onOpen ? [{ label: 'Open', onClick: () => { onOpen(row); setMenu(null); } }] : []),
    ...(onRename ? [{ label: 'Rename', onClick: () => { setEditing(true); setMenu(null); } }] : []),
  ];

  return (
    <>
      <span
        className={`${titleStyles.title}${className ? ` ${className}` : ''}`}
        title={label}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => { e.stopPropagation(); if (onRename) setEditing(true); }}
        onContextMenu={(e) => {
          if (menuItems.length === 0) return;
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {label}
      </span>
      {menu && menuItems.length > 0 && (
        <RightClickMenu position={menu} onClose={() => setMenu(null)} items={menuItems} />
      )}
    </>
  );
});
SectionRowTitle.displayName = 'SectionRowTitle';
