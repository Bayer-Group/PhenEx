import { FC } from 'react';
import { LegendDot } from '../../CohortSelector/LegendDot';
import { type ColorUsage } from '../../CohortSelector/ColorPicker';
import { DragHandle } from './DragHandle';
import styles from './LegendRow.module.css';

interface LegendRowProps {
  index: number;
  isDragging: boolean;
  color: string;
  parent: string;
  sub: string | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onRemove: () => void;
  onColorChange?: (color: string) => void;
  usedColors: ColorUsage[];
}

export const LegendRow: FC<LegendRowProps> = ({
  index,
  isDragging,
  color,
  parent,
  sub,
  onDragStart,
  onDragEnd,
  onRemove,
  onColorChange,
  usedColors,
}) => (
  <div className={styles.rowWrapper}>
    <div
      className={`${styles.row}${isDragging ? ` ${styles.rowDragging}` : ''}`}
      data-drop-index={index}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className={styles.dot}>
        <LegendDot
          color={color}
          isActive
          showDot={false}
          onClick={() => {}}
          onColorChange={onColorChange}
          usedColors={usedColors}
        />
      </div>
      <div className={styles.labelContainer}>
        <span className={styles.labelParent}>{parent}</span>
        <span className={styles.labelSub}>{sub ?? 'main cohort'}</span>
      </div>
      <button
        type="button"
        className={styles.removeButton}
        onClick={onRemove}
        title="Remove cohort"
        aria-label="Remove cohort"
      >
        ×
      </button>
      <DragHandle className={styles.dragHandle} />
    </div>
  </div>
);
