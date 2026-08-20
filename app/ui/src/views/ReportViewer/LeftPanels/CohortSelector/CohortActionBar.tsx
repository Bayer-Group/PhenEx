import { FC, useRef, useState, useMemo } from 'react';
import { PhenExNavBarTooltip } from '../../../../components/PhenExNavBar/PhenExNavBarTooltip';
import type { CohortGroup } from '../../types';
import styles from './CohortSelector.module.css';

interface CohortActionBarProps {
  groups: CohortGroup[];
  selectedParents: string[];
  onSelectAllParents: () => void;
  onDeselectAllParents: () => void;
}

export const CohortActionBar: FC<CohortActionBarProps> = ({
  groups,
  selectedParents,
  onSelectAllParents,
  onDeselectAllParents,
}) => {
  const allRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const [hoveredBtn, setHoveredBtn] = useState<'all' | 'clear' | null>(null);

  const parentSet = useMemo(() => new Set(selectedParents), [selectedParents]);
  const allSelected = groups.length > 0 && groups.every((g) => parentSet.has(g.parent));

  return (
    <div className={styles.actionBar}>
      <span className={styles.actionButtons}>
        <span className={styles.actionCount}>
          {selectedParents.length}/{groups.length}
        </span>
        <button
          ref={allRef}
          className={styles.clearBtn}
          onClick={onSelectAllParents}
          disabled={allSelected}
          onMouseEnter={() => setHoveredBtn('all')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          All
        </button>
        <button
          ref={clearRef}
          className={styles.clearBtn}
          onClick={onDeselectAllParents}
          disabled={selectedParents.length === 0}
          onMouseEnter={() => setHoveredBtn('clear')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          Clear
        </button>
      </span>
      <PhenExNavBarTooltip isVisible={hoveredBtn === 'all'} anchorElement={allRef.current} label="Select all cohorts" verticalPosition="above" horizontalAlignment="left" />
      <PhenExNavBarTooltip isVisible={hoveredBtn === 'clear'} anchorElement={clearRef.current} label="Deselect all cohorts" verticalPosition="above" horizontalAlignment="left" />
    </div>
  );
};
