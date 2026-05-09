import { FC, useMemo } from 'react';
import {
  type CohortClassified,
  type CharacteristicItem,
  type KdeCurve,
  collectCharacteristics,
  groupCharacteristicsBySection,
} from './types';
import { BarChartCellRenderer } from './CellRenderers/BarChartCellRenderer';
import { KDEChartCellRenderer } from './CellRenderers/KDEChartCellRenderer';
import { NumericTableCellRenderer } from './CellRenderers/NumericTableCellRenderer';
import styles from './CharacteristicsChart.module.css';
import sectionStyles from './ReportViewer.module.css';

/* ── Constants ───────────────────────────────────────────────────────── */

const BAR_ROW_H = 16;
const ROW_PADDING_TOP = 20;
const ROW_PADDING_BOTTOM = 20;
/* ── Main component ──────────────────────────────────────────────────── */

interface CharacteristicsChartProps {
  cohortData: CohortClassified[];
  sections: Record<string, string[]> | null;
  sectionRefs: Map<string, HTMLDivElement>;
}

export const CharacteristicsChart: FC<CharacteristicsChartProps> = ({
  cohortData,
  sections,
  sectionRefs,
}) => {
  const items = useMemo(() => collectCharacteristics(cohortData), [cohortData]);
  const groups = useMemo(
    () => groupCharacteristicsBySection(items, sections),
    [items, sections],
  );

  // Derive KDE data from cohortData (already loaded with table1)
  const kdeData = useMemo(() => {
    const result: Record<string, Record<string, KdeCurve>> = {};
    for (const cd of cohortData) {
      if (cd.data.kdes) result[cd.name] = cd.data.kdes;
    }
    return result;
  }, [cohortData]);

  if (!items.length) return null;

  return (
    <div className={styles.container}>
      {groups.map((g, gi) => {
        const key = g.section ?? `_ungrouped_${gi}`;
        return (
          <div
            key={key}
            ref={(el) => {
              if (el) sectionRefs.set(key, el);
              else sectionRefs.delete(key);
            }}
          >
            {g.section && (
              <h3 className={sectionStyles.sectionHeader}>{g.section}</h3>
            )}
            {g.items.map((item) => (
              <CharacteristicRow
                key={item.baseName}
                item={item}
                cohortData={cohortData}
                kdeData={kdeData}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

/* ── Row dispatcher ──────────────────────────────────────────────────── */

const CharacteristicRow: FC<{
  item: CharacteristicItem;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
}> = ({ item, cohortData, kdeData }) => {
  if (item.type === 'categorical') {
    return <CategoricalRow baseName={item.baseName} cohortData={cohortData} />;
  }
  if (item.type === 'numeric') {
    return <NumericRow name={item.baseName} cohortData={cohortData} kdeData={kdeData} />;
  }
  return <BooleanRow name={item.baseName} cohortData={cohortData} />;
};

/* ── Boolean row ─────────────────────────────────────────────────────── */

const BooleanRow: FC<{ name: string; cohortData: CohortClassified[] }> = ({
  name,
  cohortData,
}) => {
  const rowHeight =
    cohortData.length * BAR_ROW_H + ROW_PADDING_TOP + ROW_PADDING_BOTTOM;
  return (
    <div className={styles.row} style={{ height: rowHeight }}>
      <div className={styles.nameCell}>{name}</div>
      <div className={styles.chartCell}>
        <BarChartCellRenderer data={{ name, _meta: { cohortData } }} />
      </div>
    </div>
  );
};

/* ── Categorical row (each category as a sub-row) ────────────────────── */

const CategoricalRow: FC<{
  baseName: string;
  cohortData: CohortClassified[];
}> = ({ baseName, cohortData }) => {
  const categories = useMemo(() => {
    const cats: string[] = [];
    const catSet = new Set<string>();
    for (const cd of cohortData) {
      const items = cd.classified.categoricals[baseName];
      if (items) {
        for (const item of items) {
          if (!catSet.has(item.category)) {
            catSet.add(item.category);
            cats.push(item.category);
          }
        }
      }
    }
    return cats;
  }, [baseName, cohortData]);

  const subRowHeight =
    cohortData.length * BAR_ROW_H + ROW_PADDING_TOP + ROW_PADDING_BOTTOM;

  return (
    <div className={styles.categoricalGroup}>
      <div className={styles.categoricalHeader}>{baseName}</div>
      {categories.map((cat) => {
        const fullName = `${baseName}=${cat}`;
        return (
          <div key={cat} className={styles.row} style={{ height: subRowHeight }}>
            <div className={`${styles.nameCell} ${styles.subNameCell}`}>
              {cat}
            </div>
            <div className={styles.chartCell}>
              <BarChartCellRenderer
                data={{ name: fullName, _meta: { cohortData } }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ── Numeric row ─────────────────────────────────────────────────────── */

const NumericRow: FC<{
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
}> = ({ name, cohortData, kdeData }) => {
  return (
    <div className={styles.numericRow}>
      <div className={styles.nameCell}>{name}</div>
      <div className={styles.kdeCell}>
        <KDEChartCellRenderer name={name} cohortData={cohortData} kdeData={kdeData} />
      </div>
      <NumericTableCellRenderer name={name} cohortData={cohortData} />
    </div>
  );
};