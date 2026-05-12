import { FC, useMemo } from 'react';
import {
  type CohortClassified,
  type CharacteristicItem,
  type KdeCurve,
  collectCharacteristics,
  groupCharacteristicsBySection,
} from '../types';
import { BarChartCellRenderer } from '../CellRenderers/BarChartCellRenderer';
import { NumericGraphCellRenderer } from '../CellRenderers/NumericGraphCellRenderer';
import { NumericTableCellRenderer } from '../CellRenderers/NumericTableCellRenderer';
import { SectionCard } from './SectionCard';
import styles from './CharacteristicsChart.module.css';

/* ── Main component ──────────────────────────────────────────────────── */

interface CharacteristicsChartProps {
  cohortData: CohortClassified[];
  sections: Record<string, string[]> | null;
  sectionRefs: Map<string, HTMLDivElement>;
  groupTitle?: string;
}

export const CharacteristicsChart: FC<CharacteristicsChartProps> = ({
  cohortData,
  sections,
  sectionRefs,
  groupTitle,
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
          <SectionCard
            key={key}
            title={g.section ?? undefined}
            ref={(el) => {
              if (el) sectionRefs.set(key, el);
              else sectionRefs.delete(key);
            }}
          >
            {g.items.map((item) => (
              <CharacteristicRow
                key={item.baseName}
                item={item}
                cohortData={cohortData}
                kdeData={kdeData}
                groupTitle={groupTitle}
                sectionTitle={g.section}
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
  item: CharacteristicItem;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  groupTitle?: string;
  sectionTitle?: string | null;
}> = ({ item, cohortData, kdeData, groupTitle, sectionTitle }) => {
  const breadcrumbs = [groupTitle, sectionTitle ?? undefined, item.baseName].filter(Boolean) as string[];
  if (item.type === 'categorical') {
    return <CategoricalRow baseName={item.baseName} cohortData={cohortData} breadcrumbs={breadcrumbs} />;
  }
  if (item.type === 'numeric') {
    return <NumericRow name={item.baseName} cohortData={cohortData} kdeData={kdeData} breadcrumbs={breadcrumbs} />;
  }
  return <BooleanRow name={item.baseName} cohortData={cohortData} breadcrumbs={breadcrumbs} />;
};

/* ── Boolean row ─────────────────────────────────────────────────────── */

const BooleanRow: FC<{ name: string; cohortData: CohortClassified[]; breadcrumbs?: string[] }> = ({
  name,
  cohortData,
  breadcrumbs,
}) => {
  return (
    <div className={styles.row}>
      <div className={styles.nameCell}>{name}</div>
      <div className={styles.booleanChartCell}>
        <BarChartCellRenderer data={{ name, _meta: { cohortData } }} breadcrumbs={breadcrumbs} />
      </div>
    </div>
  );
};

/* ── Categorical row (each category as a sub-row) ────────────────────── */

const CategoricalRow: FC<{
  baseName: string;
  cohortData: CohortClassified[];
  breadcrumbs?: string[];
}> = ({ baseName, cohortData, breadcrumbs }) => {
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

  return (
    <div className={styles.categoricalGroup}>
      <div className={styles.categoricalHeader}>{baseName}</div>
      {categories.map((cat) => {
        const fullName = `${baseName}=${cat}`;
        return (
          <div key={cat} className={styles.row}>
            <div className={`${styles.nameCell} ${styles.subNameCell}`}>
              {cat}
            </div>
            <div className={styles.chartCell}>
              <BarChartCellRenderer
                data={{ name: fullName, _meta: { cohortData } }}
                breadcrumbs={breadcrumbs}
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
  breadcrumbs?: string[];
}> = ({ name, cohortData, kdeData, breadcrumbs }) => {
  return (
    <div className={styles.numericRow}>
      <div className={`${styles.nameCell} ${styles.numericNameCell}`}>{name}</div>
      <div className={styles.kdeCell}>
        <NumericGraphCellRenderer name={name} cohortData={cohortData} kdeData={kdeData} breadcrumbs={breadcrumbs} />
      </div>
      {/* <NumericTableCellRenderer name={name} cohortData={cohortData} /> */}
    </div>
  );
};