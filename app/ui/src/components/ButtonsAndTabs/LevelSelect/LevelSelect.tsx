import React from 'react';
import styles from './LevelSelect.module.css';

export interface LevelSelectProps {
  /** Currently selected max depth. Use `Number.POSITIVE_INFINITY` for "All". */
  value: number;
  onChange: (value: number) => void;
  /** Lowest selectable numeric level. Defaults to 0. */
  minLevel?: number;
  /** Highest selectable numeric level. Defaults to 3 (renders 0–3 + All). */
  maxLevel?: number;
  disabled?: boolean;
  title?: string;
  className?: string;
}

const ALL_VALUE = 'all';

export const LevelSelect: React.FC<LevelSelectProps> = ({
  value,
  onChange,
  minLevel = 0,
  maxLevel = 3,
  disabled = false,
  title,
  className,
}) => {
  const selectValue = Number.isFinite(value) ? String(value) : ALL_VALUE;
  const levels = Array.from({ length: maxLevel - minLevel + 1 }, (_, i) => i + minLevel);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = e.target.value;
    onChange(raw === ALL_VALUE ? Number.POSITIVE_INFINITY : Number(raw));
  };

  return (
    <select
      className={`${styles.levelSelect} ${className || ''}`}
      value={selectValue}
      onChange={handleChange}
      disabled={disabled}
      title={title}
    >
      <option value={ALL_VALUE}>All</option>
      {levels.map(level => (
        <option key={level} value={level}>
          {level}
        </option>
      ))}
    </select>
  );
};
