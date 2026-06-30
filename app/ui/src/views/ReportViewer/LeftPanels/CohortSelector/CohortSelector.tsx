import React, { FC, useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { getCohortColor, resolveCohortColor, type CohortGroup, type LegendSelection, type CohortDescriptions, type ColorOverrides } from '../../types';
import { useBarHoverStore } from '../../GraphsAndTables/RowRenderers/useBarHoverStore';
import { PhenExNavBarTooltip } from '../../../../components/PhenExNavBar/PhenExNavBarTooltip';
import { RightClickMenu } from '../../../../components/RightClickMenu/RightClickMenu';
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
  onReplace,
  onAdd,
  onRemove,
  cohortDescriptions,
  finalCohortSizes,
  headerActionsRef,
  colorOverrides,
  onSetColor,
}) => {
  const { activeIndex } = useBarHoverStore();
  const [barWidth, setBarWidth] = useState(0);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [hoveredItem, setHoveredItem] = useState<{ el: HTMLElement; isActive: boolean } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const legendBarRef = useRef<HTMLDivElement>(null);
  const totalCount = useMemo(() => groups.reduce((n, g) => n + g.subcohorts.length, 0), [groups]);

  const startItemHover = useCallback((el: HTMLElement, isActive: boolean) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredItem({ el, isActive }), 0);
  }, []);

  const stopItemHover = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
    setHoveredItem(null);
  }, []);

  // Scroll the active cohort into view, centered with padding
  useEffect(() => {
    if (activeIndex == null) return;
    const el = itemRefs.current.get(activeIndex);
    if (!el) return;
    const scrollParent = el.closest('[style*="overflow"], [class]');
    // Walk up to find the actual scrollable ancestor
    let container: HTMLElement | null = el.parentElement;
    while (container && container.scrollHeight <= container.clientHeight) {
      container = container.parentElement;
    }
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elCenter = elRect.top + elRect.height / 2 - containerRect.top + container.scrollTop;
    const target = elCenter - container.clientHeight / 2;
    container.scrollTo({ top: target, behavior: 'smooth' });
  }, [activeIndex]);

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

  const labelRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const [hoveredDescName, setHoveredDescName] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  const toggleGroupCollapse = useCallback((gi: number) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gi)) next.delete(gi);
      else next.add(gi);
      return next;
    });
  }, []);

  const [expandedDescs, setExpandedDescs] = useState<Set<string>>(new Set());

  const toggleDesc = useCallback((fullName: string) => {
    setExpandedDescs((prev) => {
      const next = new Set(prev);
      if (next.has(fullName)) next.delete(fullName);
      else next.add(fullName);
      return next;
    });
  }, []);

  const allDescKeys = useMemo(() => {
    if (!cohortDescriptions) return [];
    return groups.flatMap((g) =>
      g.subcohorts.filter((s) => s.fullName !== g.parent && cohortDescriptions[s.fullName]?.description).map((s) => s.fullName),
    );
  }, [groups, cohortDescriptions]);

  const allDescsExpanded = allDescKeys.length > 0 && allDescKeys.every((k) => expandedDescs.has(k));

  const toggleAllDescs = useCallback(() => {
    setExpandedDescs(allDescsExpanded ? new Set() : new Set(allDescKeys));
  }, [allDescsExpanded, allDescKeys]);

  useLayoutEffect(() => {
    const el = legendBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBarWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showSizes = barWidth > 200 && finalCohortSizes != null;

  const allSelected = groups.every((g) => g.subcohorts.every((s) => activeSet.has(s.fullName)));

  const handleSelectAll = useCallback(() => {
    for (const group of groups) {
      for (const sub of group.subcohorts) {
        if (!activeSet.has(sub.fullName)) onAdd(sub.fullName);
      }
    }
  }, [groups, activeSet, onAdd]);

  const handleDeselectAll = useCallback(() => {
    for (let i = selections.length - 1; i >= 0; i--) onRemove(i);
    if (!showAll) onToggleShowAll();
  }, [selections.length, onRemove, showAll, onToggleShowAll]);

  return (
    <div className={styles.legendBarContainer}>
            <div className={styles.topGradient} />

    <div ref={legendBarRef} className={styles.legendBar}>
      <div className={styles.legendBarHeader}>
        <div className={styles.headerText}>
          <div className={styles.legendBarHeaderLabel}>
            This study contains <span className={styles.legendBarHeaderCount}>{groups.length}</span> main cohorts, each with several stratifications.<br></br><br></br>
            Select the cohorts and stratifications you want to view from the list below. You can rearrange display order in the Legend tab. <br></br><br></br>
          {/* </div> */}
          {/* <div className={styles.legendBarHeaderSubLabel}> */}
            <span className={styles.legendBarHeaderCount}>{selections.length}</span> of <span className={styles.legendBarHeaderCount}>{totalCount}</span> are currently selected.
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
          <button
            type="button"
            className={styles.headerActionButton}
            onClick={toggleAllDescs}
            disabled={allDescKeys.length === 0}
          >
            {allDescsExpanded ? 'Hide cohort descriptions' : 'Show cohort descriptions'}
          </button>
        </div>
      </div>
      {/* {allDescKeys.length > 0 && (
        <button className={styles.toggleAllDescsBtn} onClick={toggleAllDescs}>
          {allDescsExpanded ? 'Hide all descriptions' : 'Show all descriptions'}
        </button>
      )} */}

      {groups.map((group, gi) => {
        const groupColor = getCohortColor(gi, 0, group.subcohorts.length);
        const visibleSubs = showAll
          ? group.subcohorts
          : group.subcohorts.filter((sub) => activeSet.has(sub.fullName));
        if (!showAll && visibleSubs.length === 0) return null;
        return (
          <div key={group.parent} className={styles.legendGroup} onContextMenu={(e) => handleGroupContextMenu(e, gi)}>
            <div className={styles.legendGroupTitle}>
              <div className={styles.legendGroupDot}>
                <LegendDot
                  color={groupColor}
                  isActive={group.subcohorts.every((s) => activeSet.has(s.fullName))}
                  partiallyActive={group.subcohorts.some((s) => activeSet.has(s.fullName)) && !group.subcohorts.every((s) => activeSet.has(s.fullName))}
                  onClick={() => handleGroupClick(gi)}
                  tooltipLabel={group.subcohorts.every((s) => activeSet.has(s.fullName)) ? 'Click to deselect all' : group.subcohorts.some((s) => activeSet.has(s.fullName)) ? 'Click to select all' : 'Click to select all'}
                  scale={1.3}
                />
              </div>
              <div className={styles.legendGroupTitleContent} onClick={() => toggleGroupCollapse(gi)}>
                <span className={styles.legendGroupTitleLabel} style={{ backgroundColor: groupColor }}>
                  {(cohortDescriptions?.[group.parent]?.display_name || group.parent).replace(/_/g, ' ')}
                </span>
                {!collapsedGroups.has(gi) && cohortDescriptions?.[group.parent]?.description && (
                  <div className={styles.legendGroupDescription}>{cohortDescriptions[group.parent].description}</div>
                )}
              </div>
              <span className={`${styles.groupCaret} ${collapsedGroups.has(gi) ? styles.groupCaretCollapsed : ''}`}>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </div>
            {!collapsedGroups.has(gi) && visibleSubs.map((sub) => {
              const isActive = activeSet.has(sub.fullName);
              const color = colorMap.get(sub.fullName);
              const selIdx = selectionIndexMap.get(sub.fullName);
              const hasDesc = sub.fullName !== group.parent && !!cohortDescriptions?.[sub.fullName]?.description;
              return (
                <div
                  key={sub.fullName}
                  ref={(el) => {
                    if (el) {
                      if (selIdx != null) itemRefs.current.set(selIdx, el);
                      labelRefs.current.set(sub.fullName, el);
                    }
                  }}
                  className={styles.legendItem}
                  onMouseEnter={() => { if (hasDesc && !expandedDescs.has(sub.fullName)) setHoveredDescName(sub.fullName); }}
                  onMouseLeave={() => { stopItemHover(); setHoveredDescName((prev) => prev === sub.fullName ? null : prev); }}
                >
                  <div className={styles.subcohortLegendDot}>
                    <LegendDot
                      color={color}
                      isActive={isActive}
                      onClick={() => { stopItemHover(); handleToggle(sub.fullName); }}
                      onColorChange={onSetColor ? (c) => onSetColor(sub.fullName, c) : undefined}
                      usedColors={usedColorsFor(sub.fullName)}
                    />
                  </div>
                  <div className={`${styles.legendItemContent} ${hasDesc ? styles.legendItemLabelClickable : ''}`} onClick={hasDesc ? () => toggleDesc(sub.fullName) : undefined}>
                    <span
                      className={`${styles.legendItemLabel} ${!isActive ? styles.legendItemLabelInactive : ''}`}
                    >
                      {sub.fullName === group.parent ? 'Main Cohort' : (cohortDescriptions?.[sub.fullName]?.display_name || sub.label).replace(/_/g, ' ')}
                    </span>
                    {hasDesc && expandedDescs.has(sub.fullName) && (
                      <div className={styles.subcohortDescription}>
                        {cohortDescriptions![sub.fullName].description}
                      </div>
                    )}
                  </div>
                  {showSizes && finalCohortSizes[sub.fullName] != null && (
                    <span className={styles.cohortSize}>
                    {finalCohortSizes[sub.fullName]!.toLocaleString()}
                    </span>
                  )}
                </div>
              );
            })}
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
              label: allDescsExpanded ? 'Hide all descriptions' : 'Show all descriptions',
              onClick: () => { toggleAllDescs(); setGroupMenu(null); },
              disabled: allDescKeys.length === 0,
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

      {/* <PhenExNavBarTooltip
        isVisible={hoveredDescName != null && !expandedDescs.has(hoveredDescName!)}
        anchorElement={hoveredDescName ? labelRefs.current.get(hoveredDescName) ?? null : null}
        label={hoveredDescName && cohortDescriptions?.[hoveredDescName]?.description ? cohortDescriptions[hoveredDescName].description! : ''}
        verticalPosition="below"
        horizontalAlignment="left"
        delay={400}
      /> */}
    </div>
    </div>
  );
};

/* ── SelectedItem (used in hide mode) ────────────────────────────────── */

interface SelectedItemProps {
  selection: LegendSelection;
  onClick: () => void;
  onMouseEnter: (el: HTMLElement) => void;
  onMouseLeave: () => void;
}

const SelectedItem = React.forwardRef<HTMLDivElement, SelectedItemProps>(({ selection, onClick, onMouseEnter, onMouseLeave }, ref) => {
  const color = getCohortColor(selection.groupIndex, selection.subIndex, selection.totalSubs);
  const idx = selection.cohortName.indexOf('__');
  const label = idx === -1 ? 'main' : selection.cohortName.substring(idx + 2);

  return (
    <div
      ref={ref}
      className={styles.legendItem}
      onMouseLeave={onMouseLeave}
    >
      <div
        className={styles.legendDot}
        style={{ background: color }}
        onClick={onClick}
      />
      <span
        className={styles.legendItemLabel}
        onMouseEnter={(e) => onMouseEnter(e.currentTarget)}
        onClick={onClick}
      >
        {label}
      </span>
    </div>
  );
});
