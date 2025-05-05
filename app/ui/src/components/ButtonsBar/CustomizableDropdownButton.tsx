import { FC, useState, useRef, useEffect } from 'react';
import styles from './CustomizableDropdownButton.module.css';
import buttonStyles from './ButtonsBar.module.css';

import { Portal } from '../common/Portal';

interface CustomizableDropdownButtonProps {
  label: string;
  content: React.ReactNode;
}

export const CustomizableDropdownButton: FC<CustomizableDropdownButtonProps> = ({
  label,
  content,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      <button className={buttonStyles.button} onClick={() => setIsOpen(!isOpen)}>
        {label}
      </button>
      {isOpen && (
        <Portal>
          <div
            ref={menuRef}
            className={styles.dropdownMenu}
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
};
