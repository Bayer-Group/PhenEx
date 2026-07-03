import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PhenExNavBarTooltip } from '../../../../components/PhenExNavBar/PhenExNavBarTooltip';
import { COLOR_PALETTES, COHORT_BASE_COLORS, type GroupColorConfig, type GroupColorMode, type HueDirection } from '../../types';
import pickerStyles from './ColorPicker.module.css';
import styles from './GroupColorPicker.module.css';

/**
 * Stable class name used by the host portal as its drag handle for the
 * group color picker.
 */
export const groupColorPickerDragHandle = 'groupColorPickerDragHandle';

/** Approximate max height for viewport clamping (two-color mode is tallest). */
export const GROUP_COLOR_PICKER_HEIGHT = 620;

function normalize(color: string): string {
  return color.replace(/\s+/g, '').toLowerCase();
}

function isValidColor(input: string): boolean {
  const v = input.trim();
  return (
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ||
    /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}/i.test(v)
  );
}

// ── Swatch ───────────────────────────────────────────────────────────────────

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
        className={`${pickerStyles.swatch} ${selected ? pickerStyles.swatchSelected : ''}`}
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

// ── ColorSection ─────────────────────────────────────────────────────────────

/**
 * A self-contained palette + custom hex input for picking a single color.
 * Used once in 'single' mode and twice (start/end) in 'two-color' mode.
 */
const ColorSection: FC<{
  label?: string;
  value: string;
  onChange: (color: string) => void;
}> = ({ label, value, onChange }) => {
  const [custom, setCustom] = useState(value);

  useEffect(() => {
    setCustom(value);
  }, [value]);

  const selectedNorm = useMemo(() => normalize(value), [value]);
  const customValid = isValidColor(custom);

  return (
    <>
      {label && <div className={styles.colorSectionLabel}>{label}</div>}
      {COLOR_PALETTES.map((palette) => (
        <div key={palette.name}>
          <div className={pickerStyles.section}>{palette.name}</div>
          <div className={pickerStyles.grid}>
            {palette.colors.map((color) => (
              <Swatch
                key={color.value}
                color={color.value}
                selected={normalize(color.value) === selectedNorm}
                onSelect={onChange}
              />
            ))}
          </div>
        </div>
      ))}
      <div className={pickerStyles.customRow}>
        <input
          type="text"
          className={`${pickerStyles.hexInput} ${customValid || !custom ? '' : pickerStyles.hexInputInvalid}`}
          value={custom}
          placeholder="#rrggbb or rgb(r,g,b)"
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customValid) onChange(custom.trim());
          }}
        />
        <button
          type="button"
          className={pickerStyles.applyButton}
          disabled={!customValid}
          onClick={() => onChange(custom.trim())}
        >
          Apply
        </button>
      </div>
    </>
  );
};

// ── GroupColorPicker ─────────────────────────────────────────────────────────

interface GroupColorPickerProps {
  /** Initial config to pre-populate the picker. */
  value?: GroupColorConfig;
  onSelect: (config: GroupColorConfig) => void;
  onClose?: () => void;
}

/**
 * Color picker for group base colors.
 *
 * Distinct from the per-cohort `ColorPicker` in two key ways:
 *   1. No `usedColors` — group base colors don't carry "taken" swatch semantics.
 *   2. Two modes via a dropdown:
 *      - **Single color**: applies an alpha-fade ramp from the chosen color across
 *        all subcohorts (matching the default getCohortColor behavior).
 *      - **Two colors**: generates a perceptually uniform LCh-interpolated palette
 *        between a start and end color (equidistant steps, like learnui.design),
 *        with a short/long toggle for which way the hue rotates around the wheel.
 */
export const GroupColorPicker: FC<GroupColorPickerProps> = ({ value, onSelect, onClose }) => {
  const [mode, setMode] = useState<GroupColorMode>(value?.mode ?? 'single');
  const [startColor, setStartColor] = useState(value?.startColor ?? COHORT_BASE_COLORS[0]);
  const [endColor, setEndColor] = useState(
    value?.endColor ?? COHORT_BASE_COLORS[Math.min(3, COHORT_BASE_COLORS.length - 1)],
  );
  const [direction, setDirection] = useState<HueDirection>(value?.direction ?? 'short');

  const handleModeChange = useCallback((next: GroupColorMode) => {
    setMode(next);
  }, []);

  const handleSingleColorChange = useCallback(
    (color: string) => {
      setStartColor(color);
      onSelect({ mode: 'single', startColor: color });
    },
    [onSelect],
  );

  const handleApplyTwoColor = useCallback(() => {
    onSelect({ mode: 'two-color', startColor, endColor, direction });
  }, [onSelect, startColor, endColor, direction]);

  return (
    <div className={pickerStyles.picker}>
      <div className={`${pickerStyles.header} ${groupColorPickerDragHandle}`}>
        <span className={pickerStyles.headerTitle}>Group base color</span>
        {onClose && (
          <button
            type="button"
            className={pickerStyles.closeButton}
            onClick={onClose}
            aria-label="Close group color picker"
            title="Close"
          >
            ×
          </button>
        )}
      </div>

      <div className={styles.modeRow}>
        <span className={styles.modeLabel}>Mode</span>
        <select
          className={styles.modeSelect}
          value={mode}
          onChange={(e) => handleModeChange(e.target.value as GroupColorMode)}
        >
          <option value="single">Single color</option>
          <option value="two-color">Two colors</option>
        </select>
      </div>

      {mode === 'single' && (
        <ColorSection value={startColor} onChange={handleSingleColorChange} />
      )}

      {mode === 'two-color' && (
        <>
          <ColorSection label="Start color" value={startColor} onChange={setStartColor} />
          <div className={styles.divider} />
          <ColorSection label="End color" value={endColor} onChange={setEndColor} />
          <div className={styles.directionRow}>
            <span className={styles.directionLabel}>Hue path</span>
            <div className={styles.directionToggle}>
              {(['short', 'long'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  className={`${styles.directionOption} ${direction === dir ? styles.directionOptionActive : ''}`}
                  onClick={() => setDirection(dir)}
                >
                  {dir === 'short' ? 'Short' : 'Long'}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={styles.applyPaletteButton}
            onClick={handleApplyTwoColor}
          >
            Apply palette
          </button>
        </>
      )}
    </div>
  );
};
