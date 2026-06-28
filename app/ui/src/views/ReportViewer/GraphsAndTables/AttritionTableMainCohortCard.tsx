import { FC, useMemo } from 'react';
import { AttritionTableCellRenderer, type ColumnConfig } from './RowRenderers/AttritionTableCellRenderer';
import { type CohortDescriptions } from '../types';
import styles from './AttritionTableMainCohortCard.module.css';

interface ChartEntry {
  cohortName: string;
  label: string;
  color: string;
  rows: any[];
  databaseSize: number | null;
}

interface AttritionTableMainCohortCardProps {
  parent: string;
  groupColor: string;
  charts: ChartEntry[];
  parentRowNames: Set<string>;
  cohortDescriptions?: CohortDescriptions;
  dimParentRows?: boolean;
  columns?: ColumnConfig[];
}

export const AttritionTableMainCohortCard: FC<AttritionTableMainCohortCardProps> = ({
  parent,
  groupColor,
  charts,
  parentRowNames,
  cohortDescriptions,
  dimParentRows = true,
  columns,
}) => {
  const mainChart = useMemo(
    () => charts.find((c) => c.cohortName === parent) ?? charts[0],
    [charts, parent],
  );

  if (!mainChart) return null;

  const hasMultiple = charts.length > 1;

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle} style={{ color: groupColor }}>
        {cohortDescriptions?.[parent]?.display_name ?? parent}
      </div>

      <div className={styles.cohortRow}>
        {charts.map((chart) => {
          const isMain = chart.cohortName === parent;
          const label = isMain
            ? 'Main Cohort'
            : (cohortDescriptions?.[chart.cohortName]?.display_name ?? chart.label);

          return (
            <div key={chart.cohortName} className={styles.cohortCell}>
              {hasMultiple && (
                <div className={styles.cohortLabel}>
                  <span
                    className={styles.cohortDot}
                    style={{ backgroundColor: chart.color }}
                  />
                  <span>{label}</span>
                </div>
              )}
              <AttritionTableCellRenderer
                rows={chart.rows}
                columns={columns}
                parentRowNames={!isMain && hasMultiple ? parentRowNames : undefined}
                dimParentRows={dimParentRows}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
