import { FC, useMemo, useRef, useState } from 'react';
import { PhenExNavBarTooltip } from '../../../../components/PhenExNavBar/PhenExNavBarTooltip';
import { COHORT_BASE_COLORS } from '../../types';
import styles from './ColorPicker.module.css';

/** Maps a palette color to the label of the cohort currently using it. */
export interface ColorUsage {
  color: string;
  cohortLabel: string;
}

interface ColorPickerProps {
  /** Currently selected color of the cohort being edited. */
  value?: string;
  /** Colors already taken by other cohorts (rendered blurred + disabled). */
  usedColors: ColorUsage[];
  onSelect: (color: string) => void;
}

/** Normalize a color string for equality comparison (strips whitespace, lowercases). */
function normalize(color: string): string {
  return color.replace(/\s+/g, '').toLowerCase();
}

/** Validate a hex (#rgb/#rrggbb) or rgb()/rgba() color string. */
function isValidColor(input: string): boolean {
  const v = input.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return true;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i.test(v)) return true;
  return false;
}

const Swatch: FC<{
  color: string;
  selected: boolean;
  usedBy?: string;
  onSelect: (color: string) => void;
}> = ({ color, selected, usedBy, onSelect }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const disabled = usedBy != null && !selected;

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={`${styles.swatch} ${selected ? styles.swatchSelected : ''} ${disabled ? styles.swatchUsed : ''}`}
        style={{ background: color }}
        disabled={disabled}
        onClick={() => onSelect(color)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <PhenExNavBarTooltip
        isVisible={hovered && usedBy != null}
        anchorElement={ref.current}
        label={usedBy ? `Used by ${usedBy}` : ''}
        verticalPosition="above"
        horizontalAlignment="center"
        delay={200}
      />
    </>
  );
};

export const ColorPicker: FC<ColorPickerProps> = ({ value, usedColors, onSelect }) => {
  const [custom, setCustom] = useState(value ?? '#000000');

  const usedMap = useMemo(() => {
    const map = new Map<string, string>();
    usedColors.forEach((u) => map.set(normalize(u.color), u.cohortLabel));
    return map;
  }, [usedColors]);

  const selectedNorm = value ? normalize(value) : '';
  const customValid = isValidColor(custom);

  return (
    <div className={styles.picker}>
      <div className={styles.section}>Palette</div>
      <div className={styles.grid}>
        {COHORT_BASE_COLORS.map((color) => {
          const norm = normalize(color);
          const selected = norm === selectedNorm;
          return (
            <Swatch
              key={color}
              color={color}
              selected={selected}
              usedBy={usedMap.get(norm)}
              onSelect={onSelect}
            />
          );
        })}
      </div>

      <div className={styles.section}>Custom</div>
      <div className={styles.customRow}>
        <input
          type="color"
          className={styles.wheel}
          value={/^#([0-9a-f]{6})$/i.test(custom) ? custom : '#000000'}
          onChange={(e) => {
            setCustom(e.target.value);
            onSelect(e.target.value);
          }}
        />
        <input
          type="text"
          className={`${styles.hexInput} ${customValid ? '' : styles.hexInputInvalid}`}
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
