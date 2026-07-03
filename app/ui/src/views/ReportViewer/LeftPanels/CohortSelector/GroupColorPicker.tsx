import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PhenExNavBarTooltip } from '../../../../components/PhenExNavBar/PhenExNavBarTooltip';
import { COLOR_PALETTES } from '../../types';
import styles from './ColorPicker.module.css';

/**
 * Stable class name used by the host portal as its drag handle for the
 * group color picker.
 */
export const groupColorPickerDragHandle = 'groupColorPickerDragHandle';

/** Approximate height for viewport clamping in LegendDot. */
export const GROUP_COLOR_PICKER_HEIGHT = 300;

/** Validate a hex (#rgb/#rrggbb) or rgb()/rgba() color string. */
function isValidColor(input: string): boolean {
  const v = input.trim();
  return (
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/i.test(v)
  );
}

function normalize(color: string): string {
  return color.replace(/\s+/g, '').toLowerCase();
}

interface GroupColorPickerProps {
  /** Currently selected base color of the group being edited. */
  value?: string;
  onSelect: (color: string) => void;
  onClose?: () => void;
}

const Swatch: FC<{
  color: string;
  selected: boolean;
  onSelect: (color: string) => void;
}> = ({ color, selected, onSelect }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`${styles.swatch} ${selected ? styles.swatchSelected : ''}`}
        style={{ background: color }}
        onClick={() => onSelect(color)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <PhenExNavBarTooltip
        isVisible={hovered}
        anchorElement={ref.current}
        label={color}
        verticalPosition="above"
        horizontalAlignment="center"
        delay={300}
      />
    </>
  );
};

/**
 * Color picker for group base colors.
 *
 * Distinct from the per-cohort `ColorPicker` in two ways:
 *   1. No `usedColors` — group base colors don't carry the same "taken" semantics.
 *   2. No HSV wheel — groups use palette colors; fine-grained per-pixel control is
 *      a subcohort concern, not a group concern.
 */
export const GroupColorPicker: FC<GroupColorPickerProps> = ({ value, onSelect, onClose }) => {
  const [custom, setCustom] = useState(value ?? '');

  useEffect(() => {
    setCustom(value ?? '');
  }, [value]);

  const selectedNorm = value ? normalize(value) : '';
  const customValid = isValidColor(custom);

  return (
    <div className={styles.picker}>
      <div className={`${styles.header} ${groupColorPickerDragHandle}`}>
        <span className={styles.headerTitle}>Group base color</span>
        {onClose && (
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close group color picker"
            title="Close"
          >
            ×
          </button>
        )}
      </div>

      {COLOR_PALETTES.map((palette) => (
        <div key={palette.name}>
          <div className={styles.section}>{palette.name}</div>
          <div className={styles.grid}>
            {palette.colors.map((color) => {
              const norm = normalize(color.value);
              return (
                <Swatch
                  key={color.value}
                  color={color.value}
                  selected={norm === selectedNorm}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        </div>
      ))}

      <div className={styles.section}>Custom</div>
      <div className={styles.customRow}>
        <input
          type="text"
          className={`${styles.hexInput} ${customValid || !custom ? '' : styles.hexInputInvalid}`}
          value={custom}
          placeholder="#rrggbb or rgb(r,g,b)"
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customValid) onSelect(custom.trim());
          }}
        />
        <button
          type="button"
          className={styles.applyButton}
          disabled={!customValid}
          onClick={() => onSelect(custom.trim())}
        >
          Apply
        </button>
      </div>
    </div>
  );
};
