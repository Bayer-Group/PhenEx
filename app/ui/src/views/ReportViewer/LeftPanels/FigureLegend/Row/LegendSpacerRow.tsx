import { FC } from 'react';
import { SPACER_SIZES, type LegendSpacer } from '../../../types';
import { DragHandle } from './DragHandle';
import styles from './LegendSpacerRow.module.css';

interface LegendSpacerRowProps {
  item: LegendSpacer;
  index: number;
  onDragStart: () => void;
  onDragEnd: () => void;
  onRemove: () => void;
  onSetSize: (size: 1 | 2 | 3 | 4) => void;
  onSetLabel: (label: string) => void;
}

export const LegendSpacerRow: FC<LegendSpacerRowProps> = ({
  item,
  index,
  onDragStart,
  onDragEnd,
  onRemove,
  onSetSize,
  onSetLabel,
}) => (
  <div className={styles.rowWrapper}>
    <div
      className={styles.spacerRow}
      data-drop-index={index}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <input
        className={styles.spacerLabelInput}
        value={item.label ?? ''}
        placeholder="Spacer label"
        onChange={(e) => onSetLabel(e.target.value)}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <div className={styles.spacerSizes}>
        {SPACER_SIZES.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.spacerSizeButton}${item.size === s ? ` ${styles.spacerSizeButtonActive}` : ''}`}
            onClick={() => onSetSize(s)}
            title={`Spacing ${s}`}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.removeButton}
        onClick={onRemove}
        title="Remove spacer"
        aria-label="Remove spacer"
      >
        ×
      </button>
      <DragHandle className={styles.dragHandle} />
    </div>
  </div>
);
