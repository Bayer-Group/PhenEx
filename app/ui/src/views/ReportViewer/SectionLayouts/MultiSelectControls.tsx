import { memo } from 'react';
import { Portal } from '../../../components/Portal/Portal';
import styles from './MultiSelectControls.module.css';

// ── Props ────────────────────────────────────────────────────────────────

export interface MultiSelectControlsProps {
  /** Number of currently selected cells. Hidden entirely when 0. */
  count: number;
  /** Selection can be bundled into a new group cell. */
  canGroup: boolean;
  /** Selection contains one or more group cells that can be dissolved. */
  canUngroup: boolean;
  /** At least one selected row exposes an alternate display type. */
  canChangeType: boolean;
  onGroup: () => void;
  onReset: () => void;
  onChangeType: () => void;
  onHide: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

// ── Button ───────────────────────────────────────────────────────────────

interface ControlButtonProps {
  label: string;
  shortcut: string;
  onClick: () => void;
  disabled?: boolean;
}

const ControlButton = ({ label, shortcut, onClick, disabled }: ControlButtonProps) => (
  <button type="button" className={styles.button} onClick={onClick} disabled={disabled}>
    <span className={styles.buttonLabel}>{label}</span>
    <kbd className={styles.kbd}>{shortcut}</kbd>
  </button>
);

// ── Toolbar ──────────────────────────────────────────────────────────────

/**
 * Floating action bar for the section grid's multi-cell selection. Rendered at
 * the bottom-centre of the viewport (via a {@link Portal}) whenever one or more
 * cells are selected. Purely presentational: every action is a callback owned
 * by {@link useMultiSelectActions}; the same actions are also bound to keyboard
 * shortcuts there, and the shortcut hints shown here mirror them.
 */
export const MultiSelectControls = memo<MultiSelectControlsProps>(({
  count,
  canGroup,
  canUngroup,
  canChangeType,
  onGroup,
  onReset,
  onChangeType,
  onHide,
  onSelectAll,
  onDeselectAll,
}) => {
  if (count <= 0) return null;

  return (
    <Portal>
      <div className={styles.bar} role="toolbar" aria-label="Selection actions">
        <span className={styles.count}>{count} selected</span>
        <span className={styles.divider} />
        <ControlButton
          label={canUngroup ? 'Ungroup' : 'Group'}
          shortcut="G"
          onClick={onGroup}
          disabled={!canGroup && !canUngroup}
        />
        <ControlButton label="Display" shortcut="T" onClick={onChangeType} disabled={!canChangeType} />
        <ControlButton label="Reset size" shortcut="R" onClick={onReset} />
        <ControlButton label="Hide" shortcut="H" onClick={onHide} />
        <span className={styles.divider} />
        <ControlButton label="Select all" shortcut="⌘A" onClick={onSelectAll} />
        <ControlButton label="Clear" shortcut="Esc" onClick={onDeselectAll} />
      </div>
    </Portal>
  );
});

MultiSelectControls.displayName = 'MultiSelectControls';
