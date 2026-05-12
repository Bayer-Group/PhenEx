import { FC, useMemo, useState, useCallback } from 'react';
import {
  type CohortClassified,
  type CharacteristicItem,
  type KdeCurve,
  collectCharacteristics,
  groupCharacteristicsBySection,
} from '../types';
import { BarChartCellRenderer } from './RowRenderers/BarChartCellRenderer';
import { CategoricalBarChartCellRenderer } from './RowRenderers/CategoricalBarChartCellRenderer';
import { NumericGraphCellRenderer } from './RowRenderers/NumericGraphCellRenderer';
import { BooleanRowModal } from './ModalRenderers/BooleanRowModal';
import { NumericGraphModal } from './ModalRenderers/NumericGraphModal';
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
  const [modalOpen, setModalOpen] = useState(false);
  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <div className={styles.row} onClick={openModal} style={{ cursor: 'pointer' }}>
      <div className={styles.nameCell}>{name}</div>
      <div className={styles.booleanChartCell}>
        <BarChartCellRenderer data={{ name, _meta: { cohortData } }} isModal />
      </div>
      {modalOpen && (
        <BooleanRowModal name={name} cohortData={cohortData} onClose={closeModal} breadcrumbs={breadcrumbs} />
      )}
    </div>
  );
};

/* ── Categorical row (each category as a sub-row) ────────────────────── */

const CategoricalRow: FC<{
  baseName: string;
  cohortData: CohortClassified[];
  breadcrumbs?: string[];
}> = ({ baseName, cohortData, breadcrumbs }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  return (
    <div className={styles.numericRow} onClick={openModal} style={{ cursor: 'pointer' }}>
      <div className={`${styles.nameCell} ${styles.numericNameCell}`}>{baseName}</div>
      <div className={styles.kdeCell}>
        <CategoricalBarChartCellRenderer
          baseName={baseName}
          cohortData={cohortData}
          orientation="vertical"
        />
      </div>
      {modalOpen && (
        <BooleanRowModal name={baseName} cohortData={cohortData} onClose={closeModal} breadcrumbs={breadcrumbs} />
      )}
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
  const [modalOpen, setModalOpen] = useState(false);
  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const { xMin, xMax } = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const cd of cohortData) {
      const row = cd.data.rows.find((r) => r.Name === name);
      if (!row) continue;
      if (row.Min != null && row.Min < lo) lo = row.Min;
      if (row.Max != null && row.Max > hi) hi = row.Max;
    }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    return { xMin: lo, xMax: hi };
  }, [name, cohortData]);

  return (
    <div className={styles.numericRow} onClick={openModal} style={{ cursor: 'pointer' }}>
      <div className={`${styles.nameCell} ${styles.numericNameCell}`}>{name}</div>
      <div className={styles.kdeCell}>
        <NumericGraphCellRenderer name={name} cohortData={cohortData} kdeData={kdeData} />
      </div>
      {modalOpen && (
        <NumericGraphModal
          name={name}
          cohortData={cohortData}
          kdeData={kdeData}
          xMin={xMin}
          xMax={xMax}
          onClose={closeModal}
          breadcrumbs={breadcrumbs}
        />
      )}
    </div>
  );
};