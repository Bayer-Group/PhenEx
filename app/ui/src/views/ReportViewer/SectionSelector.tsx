import { FC } from 'react';
import styles from './SectionSelector.module.css';

interface SectionSelectorProps {
  title?: string;
  sections: string[];
  onSelect: (section: string) => void;
}

export const SectionSelector: FC<SectionSelectorProps> = ({
  title,
  sections,
  onSelect,
}) => {
  if (!sections.length) {
    return null;
  }

  return (
    <div className={styles.list} data-no-pan>
      {title && <div className={styles.title}>{title}</div>}
      {sections.map((name) => (
        <button
          key={name}
          className={styles.item}
          onClick={() => onSelect(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
};
