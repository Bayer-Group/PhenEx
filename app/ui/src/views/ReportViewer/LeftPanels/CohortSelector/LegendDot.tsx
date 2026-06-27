import React, { FC, useRef, useState, useCallback } from 'react';
import { PhenExNavBarTooltip } from '../../../../components/PhenExNavBar/PhenExNavBarTooltip';
import { DraggablePortal } from '../../../../components/Portal/DraggablePortal';
import { ColorPicker, colorPickerDragHandle, type ColorUsage } from './ColorPicker';
import styles from './LegendDot.module.css';

const PICKER_WIDTH = 300;
const PICKER_HEIGHT = 230;

interface LegendDotProps {
  color?: string;
  isActive: boolean;
  partiallyActive?: boolean;
  onClick: () => void;
  tooltipLabel?: string;
  scale?: number;
  /** When false, the selection dot is hidden (color picker remains if enabled). */
  showDot?: boolean;
  /** When provided, the dot becomes a color-picker trigger. */
  onColorChange?: (color: string) => void;
  /** Colors already used by other cohorts (shown blurred in the picker). */
  usedColors?: ColorUsage[];
}

/** Clamp the picker so it stays fully within the viewport. */
function clampToViewport(x: number, y: number): { x: number; y: number } {
  const margin = 8;
  const maxX = window.innerWidth - PICKER_WIDTH - margin;
  const maxY = window.innerHeight - PICKER_HEIGHT - margin;
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
}) => {
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

  const openPicker = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setPickerPos(clampToViewport(e.clientX + 12, e.clientY + 12));
  }, []);

  const closePicker = useCallback(() => setPickerPos(null), []);

  const handleSelect = useCallback(
    (next: string) => {
      onColorChange?.(next);
      closePicker();
    },
    [onColorChange, closePicker],
  );

  return (
    <div className={styles.legendDotContainer}>
      {onColorChange && (
        <button
          type="button"
          className={styles.pickerButton}
          style={{
            background: getBackground(),
            border: isActive ? '1px solid transparent' : partiallyActive && color ? `1px solid ${color}` : '1px dashed #ccc',
            ...(scale != null ? { transform: `scale(${scale})` } : {}),
          }}          onClick={openPicker}
          aria-label="Change cohort color"
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
      {pickerPos && onColorChange && (
        <>
          <div className={styles.pickerBackdrop} onMouseDown={closePicker} />
          <DraggablePortal
            initialX={pickerPos.x}
            initialY={pickerPos.y}
            dragHandleSelector={`.${colorPickerDragHandle}`}
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
    </div>
  );
};
