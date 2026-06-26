import { FC } from 'react';
import styles from './SectionSelector.module.css';

interface SectionSelectorProps {
  title?: string;
  sections: string[];
  activeSection?: string | null;
  onTitleClick?: () => void;
  onSelect: (section: string) => void;
}

export const SectionSelector: FC<SectionSelectorProps> = ({
  title,
  sections,
  activeSection,
  onTitleClick,
  onSelect,
}) => {
  if (!title && !sections.length) return null;

  const isTitleActive = activeSection === title;

  return (
    <div className={styles.list} data-no-pan>
      {title && (
        <button
          className={`${styles.title} ${isTitleActive ? styles.titleActive : ''}`}
          onClick={onTitleClick}
        >
          {title}
        </button>
      )}
      {sections.map((name) => (
        <button
          key={name}
          className={`${styles.item} ${activeSection === name ? styles.itemActive : ''}`}
          onClick={() => onSelect(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
};
