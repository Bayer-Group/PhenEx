import { FC, useRef, useState, useMemo } from 'react';
import EyeSolidIcon from '../../../assets/icons/eye-solid.svg';
import EyeClosedIcon from '../../../assets/icons/eye-closed.svg';
import { PhenExNavBarTooltip } from '../../../components/PhenExNavBar/PhenExNavBarTooltip';
import type { CohortGroup, LegendSelection } from '../types';
import styles from './CohortSelector.module.css';

interface CohortActionBarProps {
  groups: CohortGroup[];
  selections: LegendSelection[];
  showAll: boolean;
  onToggleShowAll: () => void;
  onAdd: (fullName: string) => void;
  onRemove: (index: number) => void;
}

export const CohortActionBar: FC<CohortActionBarProps> = ({
  groups,
  selections,
  showAll,
  onToggleShowAll,
  onAdd,
  onRemove,
}) => {
  const eyeRef = useRef<HTMLButtonElement>(null);
  const allRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const [hoveredBtn, setHoveredBtn] = useState<'eye' | 'all' | 'clear' | null>(null);

  const activeSet = useMemo(() => new Set(selections.map((s) => s.cohortName)), [selections]);
  const totalCount = useMemo(() => groups.reduce((n, g) => n + g.subcohorts.length, 0), [groups]);

  return (
    <div className={styles.actionBar}>
      <span className={styles.actionButtons}>
        <span className={styles.actionCount}>
          {selections.length}/{totalCount}
        </span>
        <button
          ref={eyeRef}
          className={styles.eyeToggle}
          onClick={onToggleShowAll}
          onMouseEnter={() => setHoveredBtn('eye')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          <img
            src={showAll ? EyeSolidIcon : EyeClosedIcon}
            alt={showAll ? 'Showing all' : 'Selected only'}
            className={styles.eyeIcon}
          />
        </button>
        <button
          ref={allRef}
          className={styles.clearBtn}
          onClick={() => {
            for (const group of groups) {
              for (const sub of group.subcohorts) {
                if (!activeSet.has(sub.fullName)) onAdd(sub.fullName);
              }
            }
          }}
          disabled={groups.every((g) => g.subcohorts.every((s) => activeSet.has(s.fullName)))}
          onMouseEnter={() => setHoveredBtn('all')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          All
        </button>
        <button
          ref={clearRef}
          className={styles.clearBtn}
          onClick={() => { for (let i = selections.length - 1; i >= 0; i--) onRemove(i); }}
          disabled={selections.length === 0}
          onMouseEnter={() => setHoveredBtn('clear')}
          onMouseLeave={() => setHoveredBtn(null)}
        >
          Clear
        </button>
      </span>
      <PhenExNavBarTooltip isVisible={hoveredBtn === 'eye'} anchorElement={eyeRef.current} label={showAll ? 'Show selected only' : 'Show all cohorts'} verticalPosition="above" horizontalAlignment="left" />
      <PhenExNavBarTooltip isVisible={hoveredBtn === 'all'} anchorElement={allRef.current} label="Select all cohorts" verticalPosition="above" horizontalAlignment="left" />
      <PhenExNavBarTooltip isVisible={hoveredBtn === 'clear'} anchorElement={clearRef.current} label="Deselect all cohorts" verticalPosition="above" horizontalAlignment="left" />
    </div>
  );
};
