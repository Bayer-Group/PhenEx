import React, { FC, useCallback, useMemo } from 'react';
import {
  resolveCohortColor,
  deriveStratifications,
  stratificationLabel,
  type CohortGroup,
  type CohortDescriptions,
  type ColorOverrides,
} from '../../types';
import { LegendDot } from './LegendDot';
import { GroupCheckbox } from './GroupCheckbox';
import { SwitchButton } from '../../../../components/ButtonsAndTabs/SwitchButton/SwitchButton';
import { type ColorUsage } from './ColorPicker';
import styles from './CohortSelector.module.css';

interface CohortSelectorProps {
  groups: CohortGroup[];
  selectedParents: string[];
  activeStratification: string | null;
  showMainCohort: boolean;
  onToggleParent: (parent: string) => void;
  onSetStratification: (strat: string | null) => void;
  onToggleShowMainCohort: () => void;
  onSelectAllParents: () => void;
  onDeselectAllParents: () => void;
  cohortDescriptions?: CohortDescriptions;
  finalCohortSizes?: Record<string, number | null>;
  headerActionsRef?: React.RefObject<HTMLDivElement | null>;
  colorOverrides?: ColorOverrides;
  onSetColor?: (cohortName: string, color: string) => void;
}

export const CohortSelector: FC<CohortSelectorProps> = ({
  groups,
  selectedParents,
  activeStratification,
  showMainCohort,
  onToggleParent,
  onSetStratification,
  onToggleShowMainCohort,
  onSelectAllParents,
  onDeselectAllParents,
  cohortDescriptions,
  finalCohortSizes,
  headerActionsRef,
  colorOverrides,
  onSetColor,
}) => {
  const parentSet = useMemo(() => new Set(selectedParents), [selectedParents]);
  const stratifications = useMemo(() => deriveStratifications(groups), [groups]);
  const showSizes = finalCohortSizes != null;
  const allSelected = groups.length > 0 && groups.every((g) => parentSet.has(g.parent));

  // Effective color for each main cohort, honoring overrides.
  const parentColor = useCallback(
    (gi: number): string =>
      resolveCohortColor(groups[gi].parent, gi, 0, groups[gi].subcohorts.length, colorOverrides),
    [groups, colorOverrides],
  );

  // Colors used by other main cohorts, for blurring taken swatches in a picker.
  const usedColorsFor = useCallback(
    (parent: string): ColorUsage[] =>
      groups.flatMap((g, gi) =>
        g.parent === parent
          ? []
          : [{ color: parentColor(gi), cohortLabel: cohortDescriptions?.[g.parent]?.display_name ?? g.parent }],
      ),
    [groups, parentColor, cohortDescriptions],
  );

  return (
    <div className={styles.legendBarContainer}>
      <div className={styles.topGradient} />

      <div className={styles.legendBar}>
        <div className={styles.legendBarHeader}>
          <div className={styles.headerText}>
            <div className={styles.legendBarHeaderLabel}>
              Select the main cohorts you want to view, then optionally choose a
              stratification to break each cohort down.
            </div>
          </div>
          <div ref={headerActionsRef} className={styles.headerActions}>
            <button
              type="button"
              className={styles.headerActionButton}
              onClick={onSelectAllParents}
              disabled={allSelected}
            >
              Select all cohorts
            </button>
            <button
              type="button"
              className={styles.headerActionButton}
              onClick={onDeselectAllParents}
              disabled={selectedParents.length === 0}
            >
              Deselect all
            </button>
          </div>
        </div>

        {/* ── Main cohorts ─────────────────────────────────────────────── */}
        <div className={styles.sectionLabel}>Cohorts</div>
        {groups.map((group, gi) => {
          const isSelected = parentSet.has(group.parent);
          return (
            <div key={group.parent} className={styles.groupRow}>
              <div className={styles.legendGroupDot}>
                <GroupCheckbox
                  isSelected={isSelected}
                  isPartial={false}
                  onClick={() => onToggleParent(group.parent)}
                />
              </div>
              <div className={styles.subcohortLegendDot} onClick={(e) => e.stopPropagation()}>
                <LegendDot
                  color={parentColor(gi)}
                  isActive={isSelected}
                  onClick={() => onToggleParent(group.parent)}
                  onColorChange={onSetColor ? (c) => onSetColor(group.parent, c) : undefined}
                  usedColors={usedColorsFor(group.parent)}
                />
              </div>
              <span
                className={styles.groupRowLabel}
                onClick={() => onToggleParent(group.parent)}
                style={{ cursor: 'pointer' }}
              >
                {(cohortDescriptions?.[group.parent]?.display_name || group.parent).replace(/_/g, ' ')}
              </span>
              {showSizes && finalCohortSizes![group.parent] != null && (
                <span className={styles.cohortSize}>{finalCohortSizes![group.parent]!.toLocaleString()}</span>
              )}
            </div>
          );
        })}

        {/* ── Stratifications ──────────────────────────────────────────── */}
        {stratifications.length > 0 && (
          <div className={styles.stratSection}>
            <div className={styles.sectionLabel}>Stratifications</div>
            <button
              type="button"
              className={styles.radioRow}
              onClick={() => onSetStratification(null)}
            >
              <span className={`${styles.radio}${activeStratification === null ? ` ${styles.radioSelected}` : ''}`} />
              <span className={styles.radioLabel}>None (main cohorts)</span>
            </button>
            {stratifications.map((key) => {
              const selected = activeStratification === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={styles.radioRow}
                  onClick={() => onSetStratification(key)}
                >
                  <span className={`${styles.radio}${selected ? ` ${styles.radioSelected}` : ''}`} />
                  <span className={styles.radioLabel}>{stratificationLabel(key)}</span>
                </button>
              );
            })}

            {activeStratification !== null && (
              <div className={styles.showMainRow}>
                <SwitchButton
                  label="Show main cohort"
                  value={showMainCohort}
                  onValueChange={onToggleShowMainCohort}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

