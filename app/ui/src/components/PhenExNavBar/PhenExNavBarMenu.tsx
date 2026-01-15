import React, { useRef, useEffect } from 'react';
import { Portal } from '../Portal/Portal';
import styles from './PhenExNavBarMenu.module.css';

export interface PhenExNavBarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  anchorElement?: HTMLElement | null;
  children: React.ReactNode;
  menuRef?: React.RefObject<HTMLDivElement>;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  verticalPosition?: 'above' | 'below';
  horizontalAlignment?: 'left' | 'center' | 'right';
  gap?: number;
}

export const PhenExNavBarMenu: React.FC<PhenExNavBarMenuProps> = ({
  isOpen,
  onClose,
  anchorElement,
  children,
  menuRef: externalMenuRef,
  onMouseEnter,
  onMouseLeave,
  verticalPosition = 'above',
  horizontalAlignment = 'center',
  gap = 10,
}) => {
  const internalMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = externalMenuRef || internalMenuRef;

  // Apply 'menuShowing' class to anchor element when menu is open
  useEffect(() => {
    if (!anchorElement) return;

    if (isOpen) {
      anchorElement.classList.add('menuShowing');
    } else {
      anchorElement.classList.remove('menuShowing');
    }

    return () => {
      anchorElement.classList.remove('menuShowing');
    };
  }, [isOpen, anchorElement]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Small delay to avoid immediate close from the same click that opened it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
    }, 0);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate position relative to anchor element
  const getMenuPosition = () => {
    if (!anchorElement) return {};
    
    const rect = anchorElement.getBoundingClientRect();
    const style: React.CSSProperties = {
      position: 'fixed' as const,
    };

    // Vertical positioning
    if (verticalPosition === 'above') {
      style.bottom = `${window.innerHeight - rect.top + gap}px`;
    } else {
      style.top = `${rect.bottom + gap}px`;
    }

    // Horizontal positioning
    if (horizontalAlignment === 'center') {
      style.left = `${rect.left + rect.width / 2}px`;
      style.transform = 'translateX(-50%)';
    } else if (horizontalAlignment === 'left') {
      style.left = `${rect.left}px`;
    } else {
      style.left = `${rect.right}px`;
      style.transform = 'translateX(-100%)';
    }

    return style;
  };

  return (
    <Portal>
      <div
        ref={menuRef}
        className={styles.menu}
        style={getMenuPosition()}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </div>
    </Portal>
  );
};
