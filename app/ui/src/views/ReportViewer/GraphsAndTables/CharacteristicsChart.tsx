import { FC, useMemo, useState, useCallback } from 'react';
import {
  type CohortClassified,
  type CharacteristicItem,
  type KdeCurve,
  collectCharacteristics,
  groupCharacteristicsBySection,
} from '../types';
import { type SequentialRow } from '../studyRegistryUtils';
import { BarChartCellRenderer } from './RowRenderers/BarChartCellRenderer';
import { CategoricalBarChartCellRenderer } from './RowRenderers/CategoricalBarChartCellRenderer';
import { NumericGraphCellRenderer } from './RowRenderers/NumericGraphCellRenderer';
import { HorizontalRowViewer } from './ModalRenderers/HorizontalRowViewer';
import { SectionCard } from './SectionCard';
import styles from './CharacteristicsChart.module.css';

/* ── Main component ──────────────────────────────────────────────────── */

interface CharacteristicsChartProps {
  cohortData: CohortClassified[];
  sections: Record<string, string[]> | null;
  sectionRefs: Map<string, HTMLDivElement>;
  groupTitle?: string;
  sequentialRows?: SequentialRow[];
}

export const CharacteristicsChart: FC<CharacteristicsChartProps> = ({
  cohortData,
  sections,
  sectionRefs,
  groupTitle,
  sequentialRows,
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

  // Modal state: index into sequentialRows, or null
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const closeViewer = useCallback(() => setViewerIndex(null), []);

  // Build a lookup: row name → sequential index for this reporter
  const nameToSeqIndex = useMemo(() => {
    const map = new Map<string, number>();
    if (!sequentialRows) return map;
    for (const sr of sequentialRows) {
      if (!map.has(sr.name)) map.set(sr.name, sr.index);
    }
    return map;
  }, [sequentialRows]);

  const openRow = useCallback((name: string) => {
    const idx = nameToSeqIndex.get(name);
    if (idx != null) setViewerIndex(idx);
  }, [nameToSeqIndex]);

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
                onOpen={openRow}
              />
            ))}
          </SectionCard>
        );
      })}
      {viewerIndex != null && sequentialRows && (
        <HorizontalRowViewer
          rows={sequentialRows}
          currentIndex={viewerIndex}
          cohortData={cohortData}
          kdeData={kdeData}
          onClose={closeViewer}
          onNavigate={setViewerIndex}
        />
      )}
    </div>
  );
};

/* ── Row dispatcher ──────────────────────────────────────────────────── */

const CharacteristicRow: FC<{
  item: CharacteristicItem;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  onOpen: (name: string) => void;
}> = ({ item, cohortData, kdeData, onOpen }) => {
  if (item.type === 'categorical') {
    return <CategoricalRow baseName={item.baseName} cohortData={cohortData} onOpen={onOpen} />;
  }
  if (item.type === 'numeric') {
    return <NumericRow name={item.baseName} cohortData={cohortData} kdeData={kdeData} onOpen={onOpen} />;
  }
  return <BooleanRow name={item.baseName} cohortData={cohortData} onOpen={onOpen} />;
};

/* ── Boolean row ─────────────────────────────────────────────────────── */

const BooleanRow: FC<{ name: string; cohortData: CohortClassified[]; onOpen: (name: string) => void }> = ({
  name,
  cohortData,
  onOpen,
}) => {
  const handleClick = useCallback(() => onOpen(name), [name, onOpen]);

  return (
    <div className={styles.row} onClick={handleClick} style={{ cursor: 'pointer' }}>
      <div className={styles.nameCell}>{name}</div>
      <div className={styles.booleanChartCell}>
        <BarChartCellRenderer data={{ name, _meta: { cohortData } }} isModal />
      </div>
    </div>
  );
};

/* ── Categorical row (each category as a sub-row) ────────────────────── */

const CategoricalRow: FC<{
  baseName: string;
  cohortData: CohortClassified[];
  onOpen: (name: string) => void;
}> = ({ baseName, cohortData, onOpen }) => {
  const handleClick = useCallback(() => onOpen(baseName), [baseName, onOpen]);

  return (
    <div className={styles.numericRow} onClick={handleClick} style={{ cursor: 'pointer' }}>
      <div className={`${styles.nameCell} ${styles.numericNameCell}`}>{baseName}</div>
      <div className={styles.kdeCell}>
        <CategoricalBarChartCellRenderer
          baseName={baseName}
          cohortData={cohortData}
          orientation="vertical"
        />
      </div>
    </div>
  );
};

/* ── Numeric row ─────────────────────────────────────────────────────── */

const NumericRow: FC<{
  name: string;
  cohortData: CohortClassified[];
  kdeData: Record<string, Record<string, KdeCurve>>;
  onOpen: (name: string) => void;
}> = ({ name, cohortData, kdeData, onOpen }) => {
  const handleClick = useCallback(() => onOpen(name), [name, onOpen]);

  return (
    <div className={styles.numericRow} onClick={handleClick} style={{ cursor: 'pointer' }}>
      <div className={`${styles.nameCell} ${styles.numericNameCell}`}>{name}</div>
      <div className={styles.kdeCell}>
        <NumericGraphCellRenderer name={name} cohortData={cohortData} kdeData={kdeData} />
      </div>
    </div>
  );
};