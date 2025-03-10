import { FC, useState, useRef, useEffect } from 'react';
import styles from './ButtonsBar.module.css';

interface DropdownButtonProps {
  label: string;
  items: string[];
  onSelection: (item: string) => void;
}

export const DropdownButton: FC<DropdownButtonProps> = ({ label, items, onSelection }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <button className={styles.button} onClick={() => setIsOpen(!isOpen)}>
        {label}
      </button>
      {isOpen && (
        <div className={styles.dropdownMenu}>
          {items.map((item, index) => (
            <button
              key={`${item}-${index}`}
              className={styles.dropdownItem}
              onClick={() => {
                onSelection(item);
                setIsOpen(false);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
