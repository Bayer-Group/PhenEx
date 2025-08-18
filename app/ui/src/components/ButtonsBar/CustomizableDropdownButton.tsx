import { FC, useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import styles from './CustomizableDropdownButton.module.css';
import buttonStyles from './ButtonsBar.module.css';

import { Portal } from '../common/Portal';

interface CustomizableDropdownButtonProps {
  label: string;
  content: React.ReactNode;
  outline?: boolean;
  menuClassName?: string;
  customizableDropdownButtonRef?: React.RefObject<{ closeDropdown: () => void }>;
}

export const CustomizableDropdownButton = forwardRef<
  { closeDropdown: () => void },
  CustomizableDropdownButtonProps
>(({ label, content, menuClassName = 'dropdownMenu', outline=false }, customizableDropdownButtonRef) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(customizableDropdownButtonRef, () => ({
    closeDropdown: () => setIsOpen(false),
  }));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isClickInDropdown = dropdownRef.current?.contains(event.target as Node);
      const isClickInMenu = menuRef.current?.contains(event.target as Node);

      if (!isClickInMenu) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <button className={`${buttonStyles.button} ${outline ? buttonStyles.outline : ''}`} onClick={() => setIsOpen(!isOpen)}>
        {label}
      </button>
      {isOpen && (
        <Portal>
          <div
            ref={menuRef}
            className={`${styles.dropdownMenu} ${menuClassName}`}
            style={{
              top: dropdownRef.current?.getBoundingClientRect().bottom - 40,
              left: dropdownRef.current?.getBoundingClientRect().left,
            }}
          >
            {content}
          </div>
        </Portal>
      )}
    </div>
  );
});
