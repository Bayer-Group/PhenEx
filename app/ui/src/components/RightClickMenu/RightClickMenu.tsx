import React, { useEffect, useRef, useState } from 'react';
import styles from './RightClickMenu.module.css';

export interface RightClickMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean; // If true, render a divider line after this item
  icon?: React.ReactNode; // Optional icon to display with the item
  submenu?: RightClickMenuItem[]; // Optional submenu items
  keepOpenOnClick?: boolean; // If true, menu stays open after clicking this item
}

export interface RightClickMenuProps {
  items: RightClickMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

/**
 * RightClickMenu - Generic context menu component
 * 
 * Displays a menu at the specified position with custom menu items.
 * Automatically closes on click outside or ESC key.
 * Handles viewport boundaries to keep menu visible.
 */
export const RightClickMenu: React.FC<RightClickMenuProps> = ({
  items,
  position,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenuIndex, setActiveSubmenuIndex] = useState<number | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ x: number; y: number } | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const submenuHoverRef = useRef(false);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close menu on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Adjust position to keep menu within viewport
  const adjustedPosition = React.useMemo(() => {
    const menuWidth = 200; // Approximate width
    const menuHeight = items.length * 32; // Approximate height based on items
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y;

    // Adjust if menu would go off right edge
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }

    // Adjust if menu would go off bottom edge
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }

    return { x, y };
  }, [position, items.length]);

  const handleItemClick = (item: RightClickMenuItem) => {
    if (!item.disabled && !item.submenu) {
      item.onClick();
      if (!item.keepOpenOnClick) {
        onClose();
      }
    }
  };

  const handleItemHover = (index: number, item: RightClickMenuItem) => {
    // Clear any pending leave timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }

    if (item.submenu && !item.disabled) {
      const itemElement = itemRefs.current[index];
      if (itemElement) {
        const rect = itemElement.getBoundingClientRect();
        const submenuWidth = 200; // Approximate width
        const viewportWidth = window.innerWidth;
        
        // Determine if submenu should appear on left or right
        const spaceOnRight = viewportWidth - rect.right;
        const spaceOnLeft = rect.left;
        const shouldShowLeft = spaceOnRight < submenuWidth && spaceOnLeft > submenuWidth;
        
        const x = shouldShowLeft ? rect.left - submenuWidth : rect.right;
        const y = rect.top;
        
        setSubmenuPosition({ x, y });
        setActiveSubmenuIndex(index);
      }
    } else {
      setActiveSubmenuIndex(null);
      setSubmenuPosition(null);
    }
  };

  const handleMouseLeave = () => {
    // Only close submenu if not hovering over it
    leaveTimeoutRef.current = setTimeout(() => {
      if (!submenuHoverRef.current) {
        setActiveSubmenuIndex(null);
        setSubmenuPosition(null);
      }
    }, 150);
  };

  const handleSubmenuMouseEnter = () => {
    submenuHoverRef.current = true;
    // Clear any pending leave timeout
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  const handleSubmenuMouseLeave = () => {
    submenuHoverRef.current = false;
    // Close the submenu when leaving it
    setActiveSubmenuIndex(null);
    setSubmenuPosition(null);
  };

  return (
    <>
      {/* Transparent backdrop to capture clicks outside */}
      <div 
        className={styles.backdrop}
        onClick={onClose}
      />
      <div
        ref={menuRef}
        className={styles.menu}
        style={{
          left: `${adjustedPosition.x}px`,
          top: `${adjustedPosition.y}px`,
        }}
        onMouseLeave={handleMouseLeave}
      >
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <div
              ref={el => itemRefs.current[index] = el}
              className={`${styles.menuItem} ${item.disabled ? styles.disabled : ''} ${item.submenu ? styles.hasSubmenu : ''} ${activeSubmenuIndex === index ? styles.active : ''}`}
              onClick={() => handleItemClick(item)}
              onMouseEnter={() => handleItemHover(index, item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <span>{item.label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {item.icon && <span className={styles.menuItemIcon}>{item.icon}</span>}
                {item.submenu && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.7 }}>
                    <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
            </div>
            {item.divider && <div className={styles.divider} />}
          </React.Fragment>
        ))}
      </div>
      {activeSubmenuIndex !== null && submenuPosition && items[activeSubmenuIndex]?.submenu && (
        <div
          onMouseEnter={handleSubmenuMouseEnter}
          onMouseLeave={handleSubmenuMouseLeave}
        >
          <RightClickMenu
            items={items[activeSubmenuIndex].submenu!}
            position={submenuPosition}
            onClose={onClose}
          />
        </div>
      )}
    </>
  );
};
