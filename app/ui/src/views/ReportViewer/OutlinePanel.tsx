import { FC, useMemo } from 'react';
import { type SequentialRow } from './studyRegistryUtils';
import styles from './OutlinePanel.module.css';

interface OutlinePanelProps {
  rows: SequentialRow[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  attrition: 'Attrition',
  baseline_characteristics: 'Baseline characteristics',
  outcomes: 'Outcomes',
};

export const OutlinePanel: FC<OutlinePanelProps> = ({ rows, currentIndex, onNavigate }) => {
  const entries = useMemo(() => {
    const result: { name: string; level: number; rowIndex: number }[] = [];
    const seenCategories = new Set<string>();
    const seenSections = new Set<string>();
    for (const row of rows) {
      if (!seenCategories.has(row.category)) {
        seenCategories.add(row.category);
        result.push({
          name: CATEGORY_LABELS[row.category] || row.category,
          level: 0,
          rowIndex: row.index,
        });
      }
      const sectionKey = `${row.category}::${row.section}`;
      if (row.section && !seenSections.has(sectionKey)) {
        seenSections.add(sectionKey);
        result.push({ name: row.section, level: 1, rowIndex: row.index });
      }
    }
    return result;
  }, [rows]);

  return (
    <div className={styles.panel}>
      {entries.map((entry, i) => {
        const isActive =
          currentIndex >= entry.rowIndex &&
          (i + 1 >= entries.length || currentIndex < entries[i + 1].rowIndex);
        return (
          <button
            key={`${entry.name}-${i}`}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
            style={{ paddingLeft: entry.level === 0 ? 8 : 20 }}
            onClick={() => onNavigate(entry.rowIndex)}
          >
            {entry.name}
          </button>
        );
      })}
    </div>
  );
};
