import React, { FC, useRef, useState, useCallback } from 'react';
import { PhenExNavBarTooltip } from '../../../../components/PhenExNavBar/PhenExNavBarTooltip';
import { DraggablePortal } from '../../../../components/Portal/DraggablePortal';
import {
  ColorPicker,
  COLOR_PICKER_HEIGHT,
  colorPickerDragHandle,
  type ColorUsage,
} from './ColorPicker';
import {
  GroupColorPicker,
  GROUP_COLOR_PICKER_HEIGHT,
  groupColorPickerDragHandle,
} from './GroupColorPicker';
import { type GroupColorConfig } from '../../types';
import styles from './LegendDot.module.css';

const PICKER_WIDTH = 300;
const COHORT_PICKER_HEIGHT = COLOR_PICKER_HEIGHT;
const GROUP_PICKER_HEIGHT = GROUP_COLOR_PICKER_HEIGHT;

interface LegendDotProps {
  color?: string;
  isActive: boolean;
  partiallyActive?: boolean;
  onClick: () => void;
  tooltipLabel?: string;
  scale?: number;
  /** When false, the selection dot is hidden (color picker remains if enabled). */
  showDot?: boolean;
  /**
   * When provided, the dot shows a picker button that opens the per-cohort
   * `ColorPicker` (full HSV wheel + palette, with used-color blurring).
   * Mutually exclusive with `onGroupColorChange`.
   */
  onColorChange?: (color: string) => void;
  /** Colors already used by other cohorts (shown blurred in the cohort picker). */
  usedColors?: ColorUsage[];
  /**
   * When provided, the dot shows a picker button that opens the `GroupColorPicker`
   * (side-by-side start/end HSV wheels + short/long hue toggle).
   * Mutually exclusive with `onColorChange`.
   */
  onGroupColorChange?: (config: GroupColorConfig) => void;
  /** Current group color config, used to pre-populate the group picker. */
  groupColorValue?: GroupColorConfig;
}

/** Clamp the picker so it stays fully within the viewport. */
function clampToViewport(x: number, y: number, pickerHeight: number): { x: number; y: number } {
  const margin = 8;
  const maxX = window.innerWidth - PICKER_WIDTH - margin;
  const maxY = window.innerHeight - pickerHeight - margin;
  return {
    x: Math.max(margin, Math.min(x, maxX)),
    y: Math.max(margin, Math.min(y, maxY)),
  };
}

export const LegendDot: FC<LegendDotProps> = ({
  color,
  isActive,
  partiallyActive = false,
  onClick,
  tooltipLabel,
  scale,
  showDot = true,
  onColorChange,
  usedColors = [],
  onGroupColorChange,
  groupColorValue,
}) => {
  const hasPickerButton = onColorChange != null || onGroupColorChange != null;
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null);

  const label = tooltipLabel ?? (isActive ? 'Click to deselect' : 'Click to select');

  const getBackground = (): string => {
    if (!color) return 'transparent';
    if (isActive) return color;
    if (partiallyActive) return `linear-gradient(to right, ${color} 50%, transparent 50%)`;
    return 'transparent';
  };

  const openPicker = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const height = onGroupColorChange != null ? GROUP_PICKER_HEIGHT : COHORT_PICKER_HEIGHT;
      setPickerPos(clampToViewport(e.clientX + 12, e.clientY + 12, height));
    },
    [onGroupColorChange],
  );

  const closePicker = useCallback(() => setPickerPos(null), []);

  const handleSelect = useCallback(
    (next: string, keepOpen = false) => {
      onColorChange?.(next);
      if (!keepOpen) closePicker();
    },
    [onColorChange, closePicker],
  );

  return (
    <div className={styles.legendDotContainer}>
      {hasPickerButton && (
        <button
          type="button"
          className={styles.pickerButton}
          style={{
            background: getBackground(),
            border: isActive ? '1px solid transparent' : partiallyActive && color ? `1px solid ${color}` : '1px dashed #ccc',
            ...(scale != null ? { transform: `scale(${scale})` } : {}),
          }}
          onClick={openPicker}
          aria-label={onGroupColorChange != null ? 'Change group color' : 'Change cohort color'}
          title="Change color"
        />
      )}
      {showDot && (
        <>
          <div
            ref={ref}
            className={styles.dot}
            style={{
              background: getBackground(),
              border: isActive ? '1px solid transparent' : partiallyActive && color ? `1px solid ${color}` : '1px dashed #ccc',
              ...(scale != null ? { transform: `scale(${scale})` } : {}),
            }}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          />
          <PhenExNavBarTooltip
            isVisible={hovered}
            anchorElement={ref.current}
            label={label}
            verticalPosition="above"
            horizontalAlignment="left"
            delay={400}
          />
        </>
      )}
      {pickerPos && onColorChange != null && (
        <>
          <div className={styles.pickerBackdrop} onMouseDown={closePicker} />
          <DraggablePortal
            initialX={pickerPos.x}
            initialY={pickerPos.y}
            dragHandleSelector={`.${colorPickerDragHandle}`}
            clampToViewport
          >
            <ColorPicker
              value={color}
              usedColors={usedColors}
              onSelect={handleSelect}
              onClose={closePicker}
            />
          </DraggablePortal>
        </>
      )}
      {pickerPos && onGroupColorChange != null && (
        <>
          <div className={styles.pickerBackdrop} onMouseDown={closePicker} />
          <DraggablePortal
            initialX={pickerPos.x}
            initialY={pickerPos.y}
            dragHandleSelector={`.${groupColorPickerDragHandle}`}
            clampToViewport
          >
            <GroupColorPicker
              value={groupColorValue ?? (color ? { mode: 'single', startColor: color } : undefined)}
              onSelect={(config, keepOpen) => { onGroupColorChange(config); if (!keepOpen) closePicker(); }}
              onClose={closePicker}
            />
          </DraggablePortal>
        </>
      )}
    </div>
  );
};
