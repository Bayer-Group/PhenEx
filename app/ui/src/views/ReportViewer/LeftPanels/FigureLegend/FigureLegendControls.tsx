import { FC, useCallback, useState } from 'react';
import ColorFilterIcon from '../../../../assets/icons/color-filter.svg';
import ArrowUpRightIcon from '../../../../assets/icons/arrow-up-right.svg';
import { DraggablePortal } from '../../../../components/Portal/DraggablePortal';
import {
  GroupColorPicker,
  GROUP_COLOR_PICKER_HEIGHT,
  groupColorPickerDragHandle,
} from '../CohortSelector/GroupColorPicker';
import { type GroupColorConfig } from '../../types';
import styles from './FigureLegendControls.module.css';

const PICKER_WIDTH = 300;

interface FigureLegendControlsProps {
  /** Current two-tone config, used to pre-populate the picker. */
  colorValue?: GroupColorConfig;
  /** Apply a generated color ramp across all currently selected cohorts. */
  onApplyColor: (config: GroupColorConfig) => void;
  /** Disable the color control when there are no cohorts to color. */
  disabled?: boolean;
  /** Whether the legend is currently shown in a floating window. */
  isFloating?: boolean;
  /** Pop the legend out to (or dock it back from) a floating window. */
  onToggleFloat?: () => void;
}

/** Clamp the picker so it stays fully within the viewport. */
function clampToViewport(x: number, y: number): { x: number; y: number } {
  const margin = 8;
  const maxX = window.innerWidth - PICKER_WIDTH - margin;
  const maxY = window.innerHeight - GROUP_COLOR_PICKER_HEIGHT - margin;
  return {
    x: Math.max(margin, Math.min(x, maxX)),
    y: Math.max(margin, Math.min(y, maxY)),
  };
}

/**
 * The row of controls shown at the top-right of the figure legend:
 *   - a "color" action that opens the two-tone `GroupColorPicker` and applies
 *     the generated ramp across every currently selected cohort at once, and
 *   - a float toggle that pops the legend out to a floating window (up-right
 *     arrow) or docks it back (down arrow) depending on its current state.
 */
export const FigureLegendControls: FC<FigureLegendControlsProps> = ({
  colorValue,
  onApplyColor,
  disabled,
  isFloating,
  onToggleFloat,
}) => {
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null);

  const openPicker = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPickerPos(clampToViewport(rect.right - PICKER_WIDTH, rect.bottom + 6));
  }, []);

  const closePicker = useCallback(() => setPickerPos(null), []);

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.controlButton}
        onClick={openPicker}
        disabled={disabled}
        aria-label="Color selected cohorts"
        title="Color selected cohorts"
      >
        <img src={ColorFilterIcon} alt="" className={styles.controlIcon} />
      </button>
      {onToggleFloat && (
        <button
          type="button"
          className={styles.controlButton}
          onClick={onToggleFloat}
          aria-label={isFloating ? 'Dock legend' : 'Pop out legend'}
          title={isFloating ? 'Dock legend' : 'Pop out into floating window'}
        >
          {isFloating ? (
            <span className={styles.glyph}>⤵</span>
          ) : (
            <img src={ArrowUpRightIcon} alt="" className={styles.controlIcon} />
          )}
        </button>
      )}
      {pickerPos && (
        <>
          <div className={styles.pickerBackdrop} onMouseDown={closePicker} />
          <DraggablePortal
            initialX={pickerPos.x}
            initialY={pickerPos.y}
            dragHandleSelector={`.${groupColorPickerDragHandle}`}
            clampToViewport
          >
            <GroupColorPicker
              value={colorValue}
              onSelect={(config, keepOpen) => {
                onApplyColor(config);
                if (!keepOpen) closePicker();
              }}
              onClose={closePicker}
            />
          </DraggablePortal>
        </>
      )}
    </div>
  );
};
