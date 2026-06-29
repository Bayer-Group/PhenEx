import React, { useMemo } from 'react';
import styles from './AttritionTableCellRenderer.module.css';

/* ── Column definitions ─────────────────────────────────────────────── */

export type ColumnKey =
  | 'category'
  | 'index'
  | 'name'
  | 'pctSource'
  | 'remaining'
  | 'delta'
  | 'n'
  | 'pct';

export interface ColumnConfig {
  key: ColumnKey;
  label: string;
  visible: boolean;
}

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'category',  label: 'Category',  visible: true },
  { key: 'index',     label: 'Index',     visible: true },
  { key: 'name',      label: 'Name',      visible: true },
  { key: 'pctSource', label: '% Source',  visible: true },
  { key: 'remaining', label: 'Remaining', visible: true },
  { key: 'delta',     label: 'Delta',     visible: true },
  { key: 'n',         label: 'N',         visible: true },
  { key: 'pct',       label: '%',         visible: true },
];

/* ── Internal row model ─────────────────────────────────────────────── */

interface TableRow {
  /** Raw Type from WaterfallRow */
  type: string;
  /** Displayed only for the first row of each type group */
  categoryLabel: string | null;
  index: string;
  name: string;
  pctSource: number | null;
  pctRemaining: number | null;
  nRemaining: number | null;
  delta: number | null;
  n: number | null;
  pct: number | null;
  isParent: boolean;
}

/* ── Props ──────────────────────────────────────────────────────────── */

interface AttritionTableCellRendererProps {
  rows: any[];
  columns?: ColumnConfig[];
  /** Names of rows shared with the parent cohort */
  parentRowNames?: Set<string>;
  /** Dim parent rows by default */
  dimParentRows?: boolean;
  /** Cohort color used for the % Remaining bar fill */
  color?: string;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function fmtN(n: number | null | undefined): string {
  if (n == null) return '–';
  return n.toLocaleString();
}

function fmtPct(p: number | null | undefined): string {
  if (p == null) return '–';
  if (p >= 99.95) return '100%';
  if (p > 0 && p < 0.05) return '<0.1%';
  return `${p.toFixed(1)}%`;
}

const CATEGORY_LABELS: Record<string, string> = {
  entry:     'Entry',
  inclusion: 'Inclusion',
  exclusion: 'Exclusion',
};

/* ── Component ──────────────────────────────────────────────────────── */

export const AttritionTableCellRenderer: React.FC<AttritionTableCellRendererProps> = ({
  rows,
  columns = DEFAULT_COLUMNS,
  parentRowNames,
  dimParentRows = true,
  color,
}) => {
  const visibleColumns = useMemo(
    () => columns.filter((c) => c.visible),
    [columns],
  );

  const tableRows = useMemo<TableRow[]>(() => {
    if (!rows?.length) return [];

    const seenTypes = new Set<string>();

    return rows
      .filter((r: any) => (r.Type ?? r.effective_type) !== 'info')
      .map((r: any) => {
        const type: string = (r.Type ?? r.effective_type ?? 'entry').toLowerCase();
        const isFirstOfType = !seenTypes.has(type);
        if (isFirstOfType) seenTypes.add(type);

        const name: string = r.Name ?? r.name ?? 'Unnamed';
        return {
          type,
          categoryLabel: isFirstOfType ? (CATEGORY_LABELS[type] ?? type) : null,
          index: r.Index ?? r.hierarchical_index ?? '',
          name,
          pctSource: r.Pct_Source_Database ?? r.pct_source_database ?? null,
          pctRemaining: r.Pct_Remaining ?? r.pct_remaining ?? null,
          nRemaining: r.Remaining ?? r.count ?? null,
          delta: r.Delta ?? (r.excluded_count != null ? -Math.abs(r.excluded_count) : null),
          n: r.N ?? r.n ?? null,
          pct: r.Pct_N ?? r.pct ?? null,
          isParent: parentRowNames?.has(name) ?? false,
        };
      });
  }, [rows, parentRowNames]);

  if (!tableRows.length) return null;

  function cellContent(col: ColumnConfig, row: TableRow): React.ReactNode {
    switch (col.key) {
      case 'category':  return row.categoryLabel ?? '';
      case 'index':     return row.index;
      case 'name':      return row.name;
      case 'pctSource': return fmtPct(row.pctSource);
      case 'remaining': {
        const barPct = Math.min(Math.max(row.pctRemaining ?? 0, 0), 100);
        return (
          <div className={styles.remainingBar}>
            <div className={styles.remainingTrack}>
              <div
                className={styles.remainingFill}
                style={{ width: `${barPct}%`, backgroundColor: color ?? 'var(--color_primary, #888)' }}
              />
            </div>
            <span
              className={styles.remainingLabel}
              style={{ left: `calc(${barPct}% + 6px)` }}
            >
              <strong>{fmtPct(row.pctRemaining)}</strong> ({fmtN(row.nRemaining)})
            </span>
          </div>
        );
      }
      case 'delta': return row.delta != null ? fmtN(row.delta) : '–';
      case 'n':     return fmtN(row.n);
      case 'pct':   return fmtPct(row.pct);
    }
  }
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {visibleColumns.map((col) => (
            <th key={col.key} className={`${styles.th} ${styles[col.key]}`}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tableRows.map((row, i) => (
          <tr
            key={i}
            className={[
              styles.tr,
              dimParentRows && row.isParent ? styles.dimmed : '',
              styles[`type_${row.type}`] ?? '',
            ].join(' ')}
          >
            {visibleColumns.map((col) => (
              <td
                key={col.key}
                className={[
                  styles.td,
                  styles[col.key],
                  col.key === 'category' && row.categoryLabel ? styles.categoryFirst : '',
                ].join(' ')}
              >
                {cellContent(col, row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
