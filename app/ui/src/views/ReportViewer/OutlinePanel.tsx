import { FC } from 'react';
import {
  type ViewerEntry,
  STUDY_INFO_CATEGORY,
  categoryKey,
  getCategoryLabel,
  getEntryLabel,
} from './studyRegistryUtils';
import styles from './OutlinePanel.module.css';

interface OutlinePanelProps {
  /** The exact list of navigable cells currently in the viewer. */
  entries: ViewerEntry[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  /** Accordion keys (section / sectionless-category) that are expanded. */
  expandedKeys: Set<string>;
  onToggleExpand: (key: string) => void;
}

/**
 * An accordion outline whose items map 1:1 to the cells the user can scroll
 * through. Categories and sections are always shown; expanding a section (or a
 * sectionless category) reveals its individual rows — which simultaneously adds
 * those rows as scrollable cells in the viewer.
 */
export const OutlinePanel: FC<OutlinePanelProps> = ({
  entries,
  currentIndex,
  onNavigate,
  expandedKeys,
  onToggleExpand,
}) => {
  const renderItem = (
    key: string,
    label: string,
    level: number,
    entryIndex: number,
    toggleKey: string | null,
  ) => {
    const isActive = currentIndex === entryIndex;
    const isExpanded = toggleKey ? expandedKeys.has(toggleKey) : false;
    return (
      <div key={key} className={styles.row} style={{ paddingLeft: level * 14 }}>
        {toggleKey ? (
          <button
            type="button"
            className={styles.chevron}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={() => onToggleExpand(toggleKey)}
          >
            <span className={`${styles.chevronIcon} ${isExpanded ? styles.chevronOpen : ''}`}>▸</span>
          </button>
        ) : (
          <span className={styles.chevronSpacer} />
        )}
        <button
          type="button"
          className={`${styles.item} ${isActive ? styles.itemActive : ''} ${styles[`level${level}`] ?? ''}`}
          onClick={() => onNavigate(entryIndex)}
        >
          {label}
        </button>
      </div>
    );
  };

  return (
    <div className={styles.panel}>
      {entries.map((entry) => {
        if (entry.kind === 'category') {
          return renderItem(
            entry.key,
            getCategoryLabel(entry.category),
            0,
            entry.index,
            entry.hasSectionlessRows ? categoryKey(entry.category) : null,
          );
        }
        if (entry.kind === 'section') {
          return renderItem(
            entry.key,
            entry.section,
            1,
            entry.index,
            entry.rows.length >= 2 ? entry.key : null,
          );
        }
        // Individual rows: only appear when their parent is expanded. The
        // study_info intro cell has no outline entry.
        if (entry.row.category === STUDY_INFO_CATEGORY) return null;
        return renderItem(entry.key, getEntryLabel(entry), 2, entry.index, null);
      })}
    </div>
  );
};
