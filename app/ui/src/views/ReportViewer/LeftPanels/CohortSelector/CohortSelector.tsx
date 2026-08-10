import React, { FC, useState, useCallback, useMemo, useRef } from 'react';
import { getCohortColor, resolveCohortColor, generateGroupColors, type GroupColorConfig, type CohortGroup, type LegendSelection, type CohortDescriptions, type ColorOverrides } from '../../types';
import { RightClickMenu } from '../../../../components/RightClickMenu/RightClickMenu';
import { Portal } from '../../../../components/Portal/Portal';
import { LegendDot } from './LegendDot';
import { type ColorUsage } from './ColorPicker';
import styles from './CohortSelector.module.css';

interface CohortSelectorProps {
  groups: CohortGroup[];
  selections: LegendSelection[];
  showAll: boolean;
  onToggleShowAll: () => void;
  onReplace: (index: number, fullName: string) => void;
  onAdd: (fullName: string) => void;
  onRemove: (index: number) => void;
  cohortDescriptions?: CohortDescriptions;
  finalCohortSizes?: Record<string, number | null>;
  headerActionsRef?: React.RefObject<HTMLDivElement | null>;
  colorOverrides?: ColorOverrides;
  onSetColor?: (cohortName: string, color: string) => void;
}

export const CohortSelector: FC<CohortSelectorProps> = ({
  groups,
  selections,
  showAll,
  onToggleShowAll,
  onAdd,
  onRemove,
  cohortDescriptions,
  finalCohortSizes,
  headerActionsRef,
  colorOverrides,
  onSetColor,
}) => {
  const [hoveredGroup, setHoveredGroup] = useState<{ gi: number; anchorEl: HTMLElement } | null>(null);
  const popoverLeaveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const handleGroupMouseEnter = useCallback((gi: number, el: HTMLElement) => {
    if (popoverLeaveTimer.current) clearTimeout(popoverLeaveTimer.current);
    setHoveredGroup({ gi, anchorEl: el });
  }, []);

  const handleGroupMouseLeave = useCallback(() => {
    popoverLeaveTimer.current = setTimeout(() => setHoveredGroup(null), 120);
  }, []);

  const handlePopoverMouseEnter = useCallback(() => {
    if (popoverLeaveTimer.current) clearTimeout(popoverLeaveTimer.current);
  }, []);

  const computePopoverStyle = useCallback((anchorEl: HTMLElement): React.CSSProperties => {
    const rect = anchorEl.getBoundingClientRect();
    const maxHeight = Math.min(window.innerHeight * 0.6, window.innerHeight - 16);
    const desiredTop = rect.top - 0;
    const top = Math.max(8, Math.min(desiredTop, window.innerHeight - maxHeight - 8));
    return { position: 'fixed', top, left: rect.right + 8, zIndex: 9999 };
  }, []);

  const activeSet = useMemo(() => new Set(selections.map((s) => s.cohortName)), [selections]);

  // Effective color for every cohort (selected or not), honoring overrides.
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach((group, gi) => {
      group.subcohorts.forEach((sub, si) => {
        map.set(sub.fullName, resolveCohortColor(sub.fullName, gi, si, group.subcohorts.length, colorOverrides));
      });
    });
    return map;
  }, [groups, colorOverrides]);

  // Colors used elsewhere, for blurring out taken swatches in a cohort's picker.
  const usedColorsFor = useCallback(
    (cohortName: string): ColorUsage[] => {
      const result: ColorUsage[] = [];
      colorMap.forEach((color, name) => {
        if (name === cohortName) return;
        const label = cohortDescriptions?.[name]?.display_name ?? name;
        result.push({ color, cohortLabel: label });
      });
      return result;
    },
    [colorMap, cohortDescriptions],
  );

  // Map fullName → selection index for quick lookup
  const selectionIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < selections.length; i++) {
      map.set(selections[i].cohortName, i);
    }
    return map;
  }, [selections]);

  const handleToggle = useCallback((fullName: string) => {
    if (activeSet.has(fullName)) {
      const idx = selectionIndexMap.get(fullName);
      if (idx != null) onRemove(idx);
    } else {
      onAdd(fullName);
    }
  }, [activeSet, selectionIndexMap, onAdd, onRemove]);

  const [groupMenu, setGroupMenu] = useState<{ position: { x: number; y: number }; groupIndex: number } | null>(null);

  const handleGroupContextMenu = useCallback((e: React.MouseEvent, groupIndex: number) => {
    e.preventDefault();
    setGroupMenu({ position: { x: e.clientX, y: e.clientY }, groupIndex });
  }, []);

  const handleGroupClick = useCallback((groupIndex: number) => {
    const group = groups[groupIndex];
    const allSelected = group.subcohorts.every((s) => activeSet.has(s.fullName));
    if (allSelected) {
      const indicesToRemove: number[] = [];
      for (const sub of group.subcohorts) {
        const idx = selectionIndexMap.get(sub.fullName);
        if (idx != null) indicesToRemove.push(idx);
      }
      indicesToRemove.sort((a, b) => b - a);
      for (const idx of indicesToRemove) {
        onRemove(idx);
      }
    } else {
      for (const sub of group.subcohorts) {
        if (!activeSet.has(sub.fullName)) onAdd(sub.fullName);
      }
    }
  }, [groups, activeSet, selectionIndexMap, onAdd, onRemove]);



  const allSelected = groups.every((g) => g.subcohorts.every((s) => activeSet.has(s.fullName)));

  const handleSelectAll = useCallback(() => {
    for (const group of groups) {
      for (const sub of group.subcohorts) {
        if (!activeSet.has(sub.fullName)) onAdd(sub.fullName);
      }
    }
  }, [groups, activeSet, onAdd]);

  /**
   * When the user picks a color config for a group, generate per-subcohort
   * colors (alpha-fade for single mode, Lab interpolation for two-color) and
   * persist each via onSetColor.
   */
  const handleSetGroupColor = useCallback(
    (groupIndex: number, config: GroupColorConfig) => {
      if (!onSetColor) return;
      const group = groups[groupIndex];
      const activeSubs = group.subcohorts.filter((sub) => activeSet.has(sub.fullName));
      const colors = generateGroupColors(config, activeSubs.length);
      activeSubs.forEach((sub, si) => onSetColor(sub.fullName, colors[si]));
    },
    [groups, activeSet, onSetColor],
  );

  const handleDeselectAll = useCallback(() => {
    for (let i = selections.length - 1; i >= 0; i--) onRemove(i);
    if (!showAll) onToggleShowAll();
  }, [selections.length, onRemove, showAll, onToggleShowAll]);

  return (
    <div className={styles.legendBarContainer}>
            <div className={styles.topGradient} />

    <div className={styles.legendBar}>
      <div className={styles.legendBarHeader}>
        <div className={styles.headerText}>
          <div className={styles.legendBarHeaderLabel}>
            Select the cohorts and stratifications you want to view from the list below. <br></br><br></br>
          {/* </div> */}
          {/* <div className={styles.legendBarHeaderSubLabel}> */}
            {/* <span className={styles.legendBarHeaderCount}>{selections.length}</span> of <span className={styles.legendBarHeaderCount}>{totalCount}</span> are currently selected. */}
            </div>
        </div>
        <div ref={headerActionsRef} className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerActionButton}
            onClick={onToggleShowAll}
          >
            {showAll ? 'Show selected only' : 'Show all available'}
          </button>
          <button
            type="button"
            className={styles.headerActionButton}
            onClick={handleSelectAll}
            disabled={allSelected}
          >
            Select all available
          </button>
          <button
            type="button"
            className={styles.headerActionButton}
            onClick={handleDeselectAll}
            disabled={selections.length === 0}
          >
            Deselect all
          </button>
        </div>
      </div>

      {groups.map((group, gi) => {
        const firstSub = group.subcohorts[0];
        const firstOverride = firstSub ? colorMap.get(firstSub.fullName) : undefined;
        const groupColor = firstOverride
          ? firstOverride.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)[^)]*\)/, 'rgb($1, $2, $3)')
          : getCohortColor(gi, 0, group.subcohorts.length);
        const lastSub = group.subcohorts[group.subcohorts.length - 1];
        const endOverride =
          group.subcohorts.length > 1 && lastSub ? colorOverrides?.[lastSub.fullName] : undefined;
        const groupColorValue: GroupColorConfig = {
          mode: 'two-color',
          startColor: groupColor,
          endColor: endOverride
            ? endOverride.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)[^)]*\)/, 'rgb($1, $2, $3)')
            : undefined,
        };
        const visibleSubs = showAll
          ? group.subcohorts
          : group.subcohorts.filter((sub) => activeSet.has(sub.fullName));
        if (!showAll && visibleSubs.length === 0) return null;
        return (
          <div
            key={group.parent}
            className={`${styles.groupRow}${hoveredGroup?.gi === gi ? ` ${styles.groupRowActive}` : ''}`}
            onMouseEnter={(e) => handleGroupMouseEnter(gi, e.currentTarget)}
            onMouseLeave={handleGroupMouseLeave}
            onContextMenu={(e) => handleGroupContextMenu(e, gi)}
          >
            <div className={styles.legendGroupDot}>
              <LegendDot
                color={groupColor}
                isActive={group.subcohorts.every((s) => activeSet.has(s.fullName))}
                partiallyActive={group.subcohorts.some((s) => activeSet.has(s.fullName)) && !group.subcohorts.every((s) => activeSet.has(s.fullName))}
                onClick={() => handleGroupClick(gi)}
                tooltipLabel={group.subcohorts.every((s) => activeSet.has(s.fullName)) ? 'Click to deselect all' : 'Click to select all'}
                scale={1.3}
                onGroupColorChange={onSetColor ? (c) => handleSetGroupColor(gi, c) : undefined}
                groupColorValue={groupColorValue}
              />
            </div>
            <span className={styles.groupRowLabel}>
              {(cohortDescriptions?.[group.parent]?.display_name || group.parent).replace(/_/g, ' ')}
            </span>
          </div>
        );
      })}

      {groupMenu && (
        <RightClickMenu
          position={groupMenu.position}
          onClose={() => setGroupMenu(null)}
          items={[
            {
              label: 'Select all',
              onClick: () => {
                const group = groups[groupMenu.groupIndex];
                for (const sub of group.subcohorts) {
                  if (!activeSet.has(sub.fullName)) onAdd(sub.fullName);
                }
                setGroupMenu(null);
              },
              disabled: groups[groupMenu.groupIndex]?.subcohorts.every((s) => activeSet.has(s.fullName)),
            },
            {
              label: 'Clear all',
              onClick: () => {
                const group = groups[groupMenu.groupIndex];
                const indicesToRemove: number[] = [];
                for (const sub of group.subcohorts) {
                  const idx = selectionIndexMap.get(sub.fullName);
                  if (idx != null) indicesToRemove.push(idx);
                }
                indicesToRemove.sort((a, b) => b - a);
                for (const idx of indicesToRemove) {
                  onRemove(idx);
                }
                setGroupMenu(null);
              },
              disabled: groups[groupMenu.groupIndex]?.subcohorts.every((s) => !activeSet.has(s.fullName)),
            },
          ]}
        />
      )}

      {/* <PhenExNavBarTooltip ... /> */}
      {hoveredGroup && (() => {
        const { gi, anchorEl } = hoveredGroup;
        const group = groups[gi];
        const visibleSubs = showAll
          ? group.subcohorts
          : group.subcohorts.filter((sub) => activeSet.has(sub.fullName));
        const showSizes = finalCohortSizes != null;
        return (
          <Portal>
            <div
              className={styles.groupPopover}
              style={computePopoverStyle(anchorEl)}
              onMouseEnter={handlePopoverMouseEnter}
              onMouseLeave={handleGroupMouseLeave}
            >
              {cohortDescriptions?.[group.parent]?.description && (
                <div className={styles.legendGroupDescription}>
                  {cohortDescriptions[group.parent].description}
                </div>
              )}
              {visibleSubs.map((sub) => {
                const isActive = activeSet.has(sub.fullName);
                const color = colorMap.get(sub.fullName);
                const hasDesc = sub.fullName !== group.parent && !!cohortDescriptions?.[sub.fullName]?.description;
                return (
                  <div key={sub.fullName} className={styles.legendItem}>
                    <div className={styles.subcohortLegendDot}>
                      <LegendDot
                        color={color}
                        isActive={isActive}
                        onClick={() => handleToggle(sub.fullName)}
                        onColorChange={onSetColor ? (c) => onSetColor(sub.fullName, c) : undefined}
                        usedColors={usedColorsFor(sub.fullName)}
                      />
                    </div>
                    <div className={styles.legendItemContent}>
                      <span className={`${styles.legendItemLabel} ${!isActive ? styles.legendItemLabelInactive : ''}`}>
                        {sub.fullName === group.parent ? 'Main Cohort' : (cohortDescriptions?.[sub.fullName]?.display_name || sub.label).replace(/_/g, ' ')}
                      </span>
                      {hasDesc && (
                        <div className={styles.subcohortDescription}>
                          {cohortDescriptions![sub.fullName].description}
                        </div>
                      )}
                    </div>
                    {showSizes && finalCohortSizes![sub.fullName] != null && (
                      <span className={styles.cohortSize}>{finalCohortSizes![sub.fullName]!.toLocaleString()}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </Portal>
        );
      })()}
    </div>
    </div>
  );
};

