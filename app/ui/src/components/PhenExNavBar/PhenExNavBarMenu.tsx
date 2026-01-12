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
}

export const PhenExNavBarMenu: React.FC<PhenExNavBarMenuProps> = ({
  isOpen,
  onClose,
  anchorElement,
  children,
  menuRef: externalMenuRef,
  onMouseEnter,
  onMouseLeave,
}) => {
  const internalMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = externalMenuRef || internalMenuRef;

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
    return {
      position: 'fixed' as const,
      left: `${rect.left + rect.width / 2}px`,
      transform: 'translateX(-50%)',
      bottom: `${window.innerHeight - rect.top + 15}px`, // 10px gap above the button
    };
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
