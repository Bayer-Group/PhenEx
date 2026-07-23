import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  COHORT_BASE_COLORS,
  TWO_COLOR_START_SWATCHES,
  TWO_COLOR_END_SWATCHES,
  type GroupColorConfig,
  type GroupColorMode,
  type HueDirection,
} from '../../types';
import { InlineColorWheel, isValidColor, parseColor, rgbToHex } from './ColorPicker';
import pickerStyles from './ColorPicker.module.css';
import styles from './GroupColorPicker.module.css';

/**
 * Stable class name used by the host portal as its drag handle for the
 * group color picker.
 */
export const groupColorPickerDragHandle = 'groupColorPickerDragHandle';

/** Approximate max height for viewport clamping (two-color mode is tallest). */
export const GROUP_COLOR_PICKER_HEIGHT = 460;

/** Default end tone when a group hasn't been given a two-tone ramp yet. */
const DEFAULT_END_COLOR = COHORT_BASE_COLORS[Math.min(3, COHORT_BASE_COLORS.length - 1)];

// ── ToneColumn ───────────────────────────────────────────────────────────────

/**
 * A compact custom color picker for a single tone: a live preview swatch, an
 * HSV wheel, and a hex input — mirroring the "Custom" section of the per-cohort
 * `ColorPicker`. Used side by side for the start and end tones.
 */
const ToneColumn: FC<{
  label: string;
  value: string;
  /** Quick-pick default swatches shown below the wheel. */
  swatches?: string[];
  onChange: (color: string) => void;
}> = ({ label, value, swatches, onChange }) => {
  const [custom, setCustom] = useState(value);

  useEffect(() => {
    setCustom(value);
  }, [value]);

  const valid = isValidColor(custom);
  const preview = valid ? custom.trim() : value;
  const wheelColor = useMemo(() => {
    const parsed = parseColor(custom) ?? parseColor(value);
    return rgbToHex(parsed ?? { r: 0, g: 0, b: 0 });
  }, [custom, value]);

  const apply = useCallback(
    (hex: string) => {
      setCustom(hex);
      onChange(hex);
    },
    [onChange],
  );

  return (
    <div className={styles.toneColumn}>
      <div className={styles.toneHeader}>
        <span className={pickerStyles.previewSwatch} style={{ background: preview }} aria-hidden />
        <span className={styles.toneLabel}>{label}</span>
      </div>
      <InlineColorWheel color={wheelColor} onChange={apply} />
      {swatches && swatches.length > 0 && (
        <div className={styles.swatchRow}>
          {swatches.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={styles.swatch}
              style={{ background: swatch }}
              title={swatch}
              aria-label={swatch}
              onClick={() => apply(swatch)}
            />
          ))}
        </div>
      )}
      <input
        type="text"
        className={`${pickerStyles.hexInput} ${valid || !custom ? '' : pickerStyles.hexInputInvalid}`}
        value={custom}
        placeholder="#rrggbb"
        onChange={(e) => setCustom(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && valid) onChange(custom.trim());
        }}
      />
    </div>
  );
};

// ── GroupColorPicker ─────────────────────────────────────────────────────────

interface GroupColorPickerProps {
  /** Initial config to pre-populate the picker. */
  value?: GroupColorConfig;
  /** When keepOpen is true, the host applies the config without closing. */
  onSelect: (config: GroupColorConfig, keepOpen?: boolean) => void;
  onClose?: () => void;
}

/**
 * Color picker for group base colors.
 *
 * Two modes via a dropdown:
 *   - **Two colors** (default): generates a perceptually uniform LCh-interpolated
 *     palette between a start and end tone (equidistant steps, like
 *     learnui.design), with a short/long toggle for the hue rotation direction.
 *     Both tones are picked with side-by-side HSV wheels and applied live.
 *   - **Single color**: applies an alpha-fade ramp from the chosen color across
 *     all subcohorts (matching the default getCohortColor behavior).
 */
export const GroupColorPicker: FC<GroupColorPickerProps> = ({ value, onSelect, onClose }) => {
  const [mode, setMode] = useState<GroupColorMode>(value?.mode ?? 'two-color');
  const [startColor, setStartColor] = useState(value?.startColor ?? COHORT_BASE_COLORS[0]);
  const [endColor, setEndColor] = useState(value?.endColor ?? DEFAULT_END_COLOR);
  const [direction, setDirection] = useState<HueDirection>(value?.direction ?? 'short');

  const handleModeChange = useCallback(
    (next: GroupColorMode) => {
      setMode(next);
      if (next === 'single') onSelect({ mode: 'single', startColor }, true);
      else onSelect({ mode: 'two-color', startColor, endColor, direction }, true);
    },
    [onSelect, startColor, endColor, direction],
  );

  const handleStartChange = useCallback(
    (color: string) => {
      setStartColor(color);
      if (mode === 'single') onSelect({ mode: 'single', startColor: color }, true);
      else onSelect({ mode: 'two-color', startColor: color, endColor, direction }, true);
    },
    [onSelect, mode, endColor, direction],
  );

  const handleEndChange = useCallback(
    (color: string) => {
      setEndColor(color);
      onSelect({ mode: 'two-color', startColor, endColor: color, direction }, true);
    },
    [onSelect, startColor, direction],
  );

  const handleDirectionChange = useCallback(
    (next: HueDirection) => {
      setDirection(next);
      onSelect({ mode: 'two-color', startColor, endColor, direction: next }, true);
    },
    [onSelect, startColor, endColor],
  );

  return (
    <div className={pickerStyles.picker}>
      <div className={`${pickerStyles.header} ${groupColorPickerDragHandle}`}>
        <span className={pickerStyles.headerTitle}>Group colors</span>
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
          <option value="two-color">Two colors</option>
          <option value="single">Single color</option>
        </select>
      </div>

      {mode === 'single' && (
        <ToneColumn label="Color" value={startColor} onChange={handleStartChange} />
      )}

      {mode === 'two-color' && (
        <>
          <div className={styles.toneRow}>
            <ToneColumn
              label="Start"
              value={startColor}
              swatches={TWO_COLOR_START_SWATCHES}
              onChange={handleStartChange}
            />
            <ToneColumn
              label="End"
              value={endColor}
              swatches={TWO_COLOR_END_SWATCHES}
              onChange={handleEndChange}
            />
          </div>
          <div className={styles.directionRow}>
            <span className={styles.directionLabel}>Hue path</span>
            <div className={styles.directionToggle}>
              {(['short', 'long'] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  className={`${styles.directionOption} ${direction === dir ? styles.directionOptionActive : ''}`}
                  onClick={() => handleDirectionChange(dir)}
                >
                  {dir === 'short' ? 'Short' : 'Long'}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
