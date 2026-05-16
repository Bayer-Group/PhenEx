import { FC, useEffect, useRef } from 'react';
import { Portal } from '@/components/Portal/Portal';
import { getCohortColor, type CohortGroup, type LegendSelection } from '../types';
import styles from './CohortSelector.module.css';

interface CohortMenuProps {
  /** Anchor element to position the menu below */
  anchorRect: DOMRect;
  groups: CohortGroup[];
  /** Currently active legend items (shown as grayed out / non-selectable) */
  activeSelections: LegendSelection[];
  /** Called when user picks a cohort */
  onSelect: (fullName: string) => void;
  /** Called when user clicks an active cohort to deselect it */
  onDeselect?: (fullName: string) => void;
  onClose: () => void;
  /** If false the menu stays open after a selection (used for multi-add). */
  closeOnSelect?: boolean;
}

export const CohortMenu: FC<CohortMenuProps> = ({
  anchorRect,
  groups,
  activeSelections,
  onSelect,
  onDeselect,
  onClose,
  closeOnSelect = true,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  void anchorRect;

  const activeSet = new Set(activeSelections.map((s) => s.cohortName));
  const activeColorMap = new Map(
    activeSelections.map((s) => [
      s.cohortName,
      getCohortColor(s.groupIndex, s.subIndex, s.totalSubs),
    ]),
  );

  const handleClick = (fullName: string) => {
    if (activeSet.has(fullName)) {
      onDeselect?.(fullName);
      return;
    }
    onSelect(fullName);
    if (closeOnSelect) onClose();
  };

  return (
    <Portal>
      <div className={styles.menuOverlay} onClick={onClose}>
        <div className={styles.menuFrame} onClick={(e) => e.stopPropagation()}>
          <div className={styles.menuTitleBar}>
            <div className={styles.menuTitle}>Cohorts</div>
          </div>
          <div ref={menuRef} className={styles.menu}>
            <div className={styles.menuGrid}>
              {groups.map((group) => (
                <div key={group.parent} className={styles.menuGroup}>
                  <div className={styles.menuGroupTitle}>{group.parent}</div>
                  {group.subcohorts.map((sub) => {
                    const isActive = activeSet.has(sub.fullName);
                    const dotColor = activeColorMap.get(sub.fullName);
                    return (
                      <div
                        key={sub.fullName}
                        className={`${styles.menuItem} ${isActive ? styles.menuItemDisabled : ''}`}
                        onClick={() => handleClick(sub.fullName)}
                      >
                        {isActive && dotColor && (
                          <span
                            className={styles.menuItemDot}
                            style={{ background: dotColor }}
                          />
                        )}
                        <span className={styles.menuItemLabel}>{sub.label}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};
