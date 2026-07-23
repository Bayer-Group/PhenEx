import { FC } from 'react';
import styles from './DatabaseFields.module.css';

interface DuckDbFieldsProps {
  duckDbPath: string;
  onPathChange: (path: string) => void;
  onSave: () => void;
}

export const DuckDbFields: FC<DuckDbFieldsProps> = ({ duckDbPath, onPathChange, onSave }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave();
    }
  };

  return (
    <div className={styles.inputGroup}>
      <label className={styles.inputLabel}>Database Path</label>
      <input
        type="text"
        className={styles.input}
        placeholder="undefined"
        value={duckDbPath}
        onChange={e => onPathChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onSave}
      />
    </div>
  );
};
