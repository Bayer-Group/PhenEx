import { FC, useCallback, useState } from 'react';
import ColorFilterIcon from '../../../../assets/icons/color-filter.svg';
import { PhenExNavBarTooltip } from '../../../../components/PhenExNavBar/PhenExNavBarTooltip';
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
  /** Disable the controls when there are no cohorts to color. */
  disabled?: boolean;
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
 * The row of controls shown at the top-right of the figure legend. For now it
 * exposes a single "color" action that opens the two-tone `GroupColorPicker`
 * and applies the generated ramp across every currently selected cohort at once.
 */
export const FigureLegendControls: FC<FigureLegendControlsProps> = ({ colorValue, onApplyColor, disabled }) => {
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [buttonEl, setButtonEl] = useState<HTMLButtonElement | null>(null);

  const openPicker = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPickerPos(clampToViewport(rect.right - PICKER_WIDTH, rect.bottom + 6));
  }, []);

  const closePicker = useCallback(() => setPickerPos(null), []);

  return (
    <div className={styles.controls}>
      <button
        ref={setButtonEl}
        type="button"
        className={styles.controlButton}
        onClick={openPicker}
        disabled={disabled}
        aria-label="Color selected cohorts"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <img src={ColorFilterIcon} alt="" className={styles.controlIcon} />
      </button>
      <PhenExNavBarTooltip
        isVisible={hovered && pickerPos == null}
        anchorElement={buttonEl}
        label="Color selected cohorts"
        verticalPosition="below"
        horizontalAlignment="right"
        delay={400}
      />
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
