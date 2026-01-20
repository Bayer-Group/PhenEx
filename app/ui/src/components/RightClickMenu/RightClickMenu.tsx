import React, { useEffect, useRef } from 'react';
import styles from './RightClickMenu.module.css';

export interface RightClickMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  divider?: boolean; // If true, render a divider line after this item
  icon?: React.ReactNode; // Optional icon to display with the item
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
    if (!item.disabled) {
      item.onClick();
      onClose();
    }
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
      >
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <div
              className={`${styles.menuItem} ${item.disabled ? styles.disabled : ''}`}
              onClick={() => handleItemClick(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <span>{item.label}</span>
              {item.icon && <span className={styles.menuItemIcon}>{item.icon}</span>}
            </div>
            {item.divider && <div className={styles.divider} />}
          </React.Fragment>
        ))}
      </div>
    </>
  );
};
