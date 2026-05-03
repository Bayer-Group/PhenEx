import { FC, useEffect, useRef, useCallback } from 'react';
import { Portal } from '@/components/Portal/Portal';
import { getCohortColor, type CohortGroup, type LegendSelection } from './types';
import styles from './CohortSelector.module.css';

interface CohortMenuProps {
  /** Anchor element to position the menu below */
  anchorRect: DOMRect;
  groups: CohortGroup[];
  /** Currently active legend items (shown as grayed out / non-selectable) */
  activeSelections: LegendSelection[];
  /** Called when user picks a cohort */
  onSelect: (fullName: string) => void;
  onClose: () => void;
}

export const CohortMenu: FC<CohortMenuProps> = ({
  anchorRect,
  groups,
  activeSelections,
  onSelect,
  onClose,
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

  // Compute position: below anchor, prevent right-edge overflow
  const computeStyle = useCallback((): React.CSSProperties => {
    let left = anchorRect.left;
    const top = anchorRect.bottom + 4;
    const menuWidth = menuRef.current?.offsetWidth ?? 400;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    if (left < 8) left = 8;
    return { position: 'fixed', top, left };
  }, [anchorRect]);

  const activeSet = new Set(activeSelections.map((s) => s.cohortName));
  const activeColorMap = new Map(
    activeSelections.map((s) => [
      s.cohortName,
      getCohortColor(s.groupIndex, s.subIndex, s.totalSubs),
    ]),
  );

  const handleClick = (fullName: string) => {
    if (activeSet.has(fullName)) return;
    onSelect(fullName);
  };

  return (
    <Portal>
      <div
        ref={menuRef}
        className={styles.menu}
        style={computeStyle()}
      >
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
    </Portal>
  );
};
