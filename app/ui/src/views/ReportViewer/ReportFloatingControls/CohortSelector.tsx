import React, { FC, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { getCohortColor, type CohortGroup, type LegendSelection, type CohortDescriptions } from '../types';
import { useBarHoverStore } from '../GraphsAndTables/RowRenderers/useBarHoverStore';
import EyeSolidIcon from '../../../assets/icons/eye-solid.svg';
import EyeClosedIcon from '../../../assets/icons/eye-closed.svg';
import { PhenExNavBarTooltip } from '../../../components/PhenExNavBar/PhenExNavBarTooltip';
import styles from './CohortSelector.module.css';

interface CohortSelectorProps {
  groups: CohortGroup[];
  selections: LegendSelection[];
  onReplace: (index: number, fullName: string) => void;
  onAdd: (fullName: string) => void;
  onRemove: (index: number) => void;
  cohortDescriptions?: CohortDescriptions;
}

export const CohortSelector: FC<CohortSelectorProps> = ({
  groups,
  selections,
  onReplace,
  onAdd,
  onRemove,
  cohortDescriptions,
}) => {
  const { activeIndex } = useBarHoverStore();
  const [showAll, setShowAll] = useState(false);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const eyeRef = useRef<HTMLButtonElement>(null);
  const allRef = useRef<HTMLButtonElement>(null);
  const clearRef = useRef<HTMLButtonElement>(null);
  const [hoveredBtn, setHoveredBtn] = useState<'eye' | 'all' | 'clear' | null>(null);
  const [hoveredItem, setHoveredItem] = useState<{ el: HTMLElement; isActive: boolean } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

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

  return (
    <div className={styles.legendBar}>
      <div className={styles.actionBar}>
        <span className={styles.actionInfo}>
          <span className={styles.actionTitle}>Cohorts</span>
          <span className={styles.actionCount}>
            {selections.length}/{groups.reduce((n, g) => n + g.subcohorts.length, 0)}
          </span>
        </span>
        <span className={styles.actionButtons}>
          <button
            ref={eyeRef}
            className={styles.eyeToggle}
            onClick={() => setShowAll((v) => !v)}
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
        <PhenExNavBarTooltip isVisible={hoveredBtn === 'eye'} anchorElement={eyeRef.current} label={showAll ? 'Show selected only' : 'Show all cohorts'} />
        <PhenExNavBarTooltip isVisible={hoveredBtn === 'all'} anchorElement={allRef.current} label="Select all cohorts" />
        <PhenExNavBarTooltip isVisible={hoveredBtn === 'clear'} anchorElement={clearRef.current} label="Deselect all cohorts" />
        <PhenExNavBarTooltip isVisible={hoveredItem !== null} anchorElement={hoveredItem?.el ?? null} label={hoveredItem?.isActive ? 'Click to hide results' : 'Click to view results'} />
      </div>

      {groups.map((group, gi) => {
        const groupColor = getCohortColor(gi, 0, group.subcohorts.length);
        const visibleSubs = showAll
          ? group.subcohorts
          : group.subcohorts.filter((sub) => activeSet.has(sub.fullName));
        if (!showAll && visibleSubs.length === 0) return null;
        return (
          <div key={group.parent} className={styles.legendGroup} style={{ borderColor: groupColor }}>
            <div className={styles.legendGroupTitle}>
              <span className={styles.legendGroupTitleLabel} style={{ backgroundColor: groupColor }}>{cohortDescriptions?.[group.parent]?.display_name || group.parent}</span>
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
                    onClick={() => { stopItemHover(); handleToggle(sub.fullName); }}
                  />
                  <span
                    className={`${styles.legendItemLabel} ${!isActive ? styles.legendItemLabelInactive : ''}`}
                    onMouseEnter={(e) => startItemHover(e.currentTarget, isActive)}
                    onClick={() => { stopItemHover(); handleToggle(sub.fullName); }}
                  >
                    {cohortDescriptions?.[sub.fullName]?.display_name || sub.label}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
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
