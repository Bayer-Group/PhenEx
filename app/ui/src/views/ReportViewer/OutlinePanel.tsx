import { FC, useMemo } from 'react';
import { type ViewerEntry, getEntryCategory, getEntrySection } from './studyRegistryUtils';
import styles from './OutlinePanel.module.css';

interface OutlinePanelProps {
  entries: ViewerEntry[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  attrition: 'Attrition',
  baseline_characteristics: 'Baseline characteristics',
  outcomes: 'Outcomes',
};

export const OutlinePanel: FC<OutlinePanelProps> = ({ entries, currentIndex, onNavigate }) => {
  // Outline items navigate to the entry index of the first entry in each
  // category/section. For multi-row sections this is the section (multi-row) cell.
  const items = useMemo(() => {
    const result: { name: string; level: number; entryIndex: number }[] = [];
    const seenCategories = new Set<string>();
    const seenSections = new Set<string>();
    for (const entry of entries) {
      const category = getEntryCategory(entry);
      const section = getEntrySection(entry);
      if (!seenCategories.has(category)) {
        seenCategories.add(category);
        result.push({
          name: CATEGORY_LABELS[category] || category,
          level: 0,
          entryIndex: entry.index,
        });
      }
      const sectionKey = `${category}::${section}`;
      if (section && !seenSections.has(sectionKey)) {
        seenSections.add(sectionKey);
        result.push({ name: section, level: 1, entryIndex: entry.index });
      }
    }
    return result;
  }, [entries]);

  return (
    <div className={styles.panel}>
      {items.map((item, i) => {
        const isActive =
          currentIndex >= item.entryIndex &&
          (i + 1 >= items.length || currentIndex < items[i + 1].entryIndex);
        return (
          <button
            key={`${item.name}-${i}`}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
            style={{ paddingLeft: item.level === 0 ? 8 : 20 }}
            onClick={() => onNavigate(item.entryIndex)}
          >
            {item.name}
          </button>
        );
      })}
    </div>
  );
};
