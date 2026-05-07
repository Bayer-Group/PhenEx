import { FC } from 'react';
import styles from './SectionSelector.module.css';

interface SectionSelectorProps {
  sections: string[];
  onSelect: (section: string) => void;
}

export const SectionSelector: FC<SectionSelectorProps> = ({
  sections,
  onSelect,
}) => {
  if (!sections.length) {
    return <div className={styles.empty}>No sections</div>;
  }

  return (
    <div className={styles.list} data-no-pan>
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
