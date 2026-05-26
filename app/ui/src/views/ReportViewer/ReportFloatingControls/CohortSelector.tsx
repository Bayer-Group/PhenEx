import React, { FC, useState, useCallback, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { getCohortColor, type CohortGroup, type LegendSelection, type CohortDescriptions } from '../types';
import { useBarHoverStore } from '../GraphsAndTables/RowRenderers/useBarHoverStore';
import { PhenExNavBarTooltip } from '../../../components/PhenExNavBar/PhenExNavBarTooltip';
import { RightClickMenu } from '../../../components/RightClickMenu/RightClickMenu';
import styles from './CohortSelector.module.css';

const MAX_LABEL_FONT = 11;
const MIN_LABEL_FONT = 8;

/** Span that shrinks its font-size when text wraps beyond one line. */
const AutoShrinkLabel: FC<{ text: string; className?: string; style?: React.CSSProperties }> = ({ text, className, style }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.fontSize = '';
    const lineH = parseFloat(getComputedStyle(el).lineHeight) || MAX_LABEL_FONT * 1.9;
    if (el.scrollHeight <= lineH + 2) return;
    for (let s = MAX_LABEL_FONT - 1; s >= MIN_LABEL_FONT; s--) {
      el.style.fontSize = `${s}px`;
      const lh = parseFloat(getComputedStyle(el).lineHeight) || s * 1.9;
      if (el.scrollHeight <= lh + 2) return;
    }
  }, [text]);

  return <span ref={ref} className={className} style={style}>{text}</span>;
};

interface CohortSelectorProps {
  groups: CohortGroup[];
  selections: LegendSelection[];
  showAll: boolean;
  onReplace: (index: number, fullName: string) => void;
  onAdd: (fullName: string) => void;
  onRemove: (index: number) => void;
  cohortDescriptions?: CohortDescriptions;
  finalCohortSizes?: Record<string, number | null>;
}

export const CohortSelector: FC<CohortSelectorProps> = ({
  groups,
  selections,
  showAll,
  onReplace,
  onAdd,
  onRemove,
  cohortDescriptions,
  finalCohortSizes,
}) => {
  const { activeIndex } = useBarHoverStore();
  const [barWidth, setBarWidth] = useState(0);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [hoveredItem, setHoveredItem] = useState<{ el: HTMLElement; isActive: boolean } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const legendBarRef = useRef<HTMLDivElement>(null);

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

  const activeColorMap = useMemo(
    () => new Map(selections.map((s) => [s.cohortName, getCohortColor(s.groupIndex, s.subIndex, s.totalSubs)])),
    [selections],
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

  useLayoutEffect(() => {
    const el = legendBarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setBarWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const showSizes = barWidth > 200 && finalCohortSizes != null;

  return (
    <div ref={legendBarRef} className={styles.legendBar}>
      <div className={styles.topGradient} />

      {groups.map((group, gi) => {
        const groupColor = getCohortColor(gi, 0, group.subcohorts.length);
        const visibleSubs = showAll
          ? group.subcohorts
          : group.subcohorts.filter((sub) => activeSet.has(sub.fullName));
        if (!showAll && visibleSubs.length === 0) return null;
        return (
          <div key={group.parent} className={styles.legendGroup} onContextMenu={(e) => handleGroupContextMenu(e, gi)} onClick={() => handleGroupClick(gi)} style={{ cursor: 'pointer' }}>
            <div className={styles.legendGroupTitle}>
              <AutoShrinkLabel text={cohortDescriptions?.[group.parent]?.display_name || group.parent} className={styles.legendGroupTitleLabel} style={{ backgroundColor: groupColor }} />
            </div>
            {cohortDescriptions?.[group.parent]?.description && (
              <div className={styles.legendGroupDescription}>{cohortDescriptions[group.parent].description}</div>
            )}
            {visibleSubs.map((sub) => {
              const isActive = activeSet.has(sub.fullName);
              const color = activeColorMap.get(sub.fullName);
              const selIdx = selectionIndexMap.get(sub.fullName);
              return (
                <div
                  key={sub.fullName}
                  ref={(el) => { if (el && selIdx != null) itemRefs.current.set(selIdx, el); }}
                  className={styles.legendItem}
                  onMouseLeave={stopItemHover}
                >
                  <div
                    className={styles.legendDot}
                    style={{ background: isActive && color ? color : 'transparent', border: isActive ? '2px solid transparent' : '2px dashed #ccc' }}
                    onClick={(e) => { e.stopPropagation(); stopItemHover(); handleToggle(sub.fullName); }}
                  />
                  <span
                    className={`${styles.legendItemLabel} ${!isActive ? styles.legendItemLabelInactive : ''}`}
                    onMouseEnter={(e) => startItemHover(e.currentTarget, isActive)}
                    onClick={(e) => { e.stopPropagation(); stopItemHover(); handleToggle(sub.fullName); }}
                  >
                    {sub.fullName === group.parent ? 'Main Cohort' : (cohortDescriptions?.[sub.fullName]?.display_name || sub.label)}
                  </span>
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
