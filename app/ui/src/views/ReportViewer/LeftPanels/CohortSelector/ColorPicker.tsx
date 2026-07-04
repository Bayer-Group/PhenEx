import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PhenExNavBarTooltip } from '../../../../components/PhenExNavBar/PhenExNavBarTooltip';
import { COLOR_PALETTES } from '../../types';
import styles from './ColorPicker.module.css';

/**
 * Stable class name used by the host portal as its drag handle. Only the
 * header drags, so the body's inputs/swatches stay fully interactive.
 */
export const colorPickerDragHandle = 'colorPickerDragHandle';

/** Approximate height for viewport clamping in LegendDot (generous upper bound). */
export const COLOR_PICKER_HEIGHT = 540;

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
  /** When keepOpen is true, the host should apply the color without closing. */
  onSelect: (color: string, keepOpen?: boolean) => void;
  onClose?: () => void;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface HSV {
  h: number;
  s: number;
  v: number;
}

/** Normalize a color string for equality comparison (strips whitespace, lowercases). */
function normalize(color: string): string {
  return color.replace(/\s+/g, '').toLowerCase();
}

/** Validate a hex (#rgb/#rrggbb) or rgb()/rgba() color string. */
export function isValidColor(input: string): boolean {
  return parseColor(input) != null;
}

export function parseColor(input: string): RGB | null {
  const v = input.trim();
  const hexMatch = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  const rgbMatch = v.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }

  return null;
}

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsv({ r, g, b }: RGB): HSV {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;

  if (delta !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / delta + 2) * 60;
        break;
      default:
        h = ((rn - gn) / delta + 4) * 60;
        break;
    }
  }

  return { h, s, v };
}

function hsvToHex(hsv: HSV): string {
  const { h, s, v } = hsv;
  const sn = s / 100;
  const vn = v / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h < 60) {
    rp = c;
    gp = x;
  } else if (h < 120) {
    rp = x;
    gp = c;
  } else if (h < 180) {
    gp = c;
    bp = x;
  } else if (h < 240) {
    gp = x;
    bp = c;
  } else if (h < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }

  return rgbToHex({
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function useDrag(onMove: (clientX: number, clientY: number) => void) {
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  return useCallback((clientX: number, clientY: number) => {
    const handleMove = (event: MouseEvent) => {
      onMoveRef.current(event.clientX, event.clientY);
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    onMoveRef.current(clientX, clientY);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, []);
}

export const InlineColorWheel: FC<{
  color: string;
  onChange: (hex: string) => void;
}> = ({ color, onChange }) => {
  const rgb = parseColor(color) ?? { r: 0, g: 0, b: 0 };
  const hsv = rgbToHsv(rgb);
  const satValRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const emitHsv = useCallback(
    (next: HSV) => {
      onChange(hsvToHex(next));
    },
    [onChange],
  );

  const updateSatVal = useCallback(
    (clientX: number, clientY: number) => {
      const el = satValRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
      const v = clamp(100 - ((clientY - rect.top) / rect.height) * 100, 0, 100);
      emitHsv({ h: hsv.h, s, v });
    },
    [emitHsv, hsv.h],
  );

  const updateHue = useCallback(
    (clientX: number) => {
      const el = hueRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 360);
      emitHsv({ h, s: hsv.s, v: hsv.v });
    },
    [emitHsv, hsv.s, hsv.v],
  );

  const startSatValDrag = useDrag(updateSatVal);
  const startHueDrag = useDrag((clientX, clientY) => {
    updateHue(clientX);
    void clientY;
  });

  return (
    <div className={styles.wheelPanel}>
      <div
        ref={satValRef}
        className={styles.satVal}
        style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
        onMouseDown={(e) => {
          e.preventDefault();
          startSatValDrag(e.clientX, e.clientY);
        }}
      >
        <span
          className={styles.wheelPointer}
          style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
        />
      </div>
      <div
        ref={hueRef}
        className={styles.hueTrack}
        onMouseDown={(e) => {
          e.preventDefault();
          startHueDrag(e.clientX, e.clientY);
        }}
      >
        <span className={styles.hueThumb} style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>
    </div>
  );
};

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

export const ColorPicker: FC<ColorPickerProps> = ({ value, usedColors, onSelect, onClose }) => {
  const [custom, setCustom] = useState(value ?? '#000000');

  useEffect(() => {
    setCustom(value ?? '#000000');
  }, [value]);

  const usedMap = useMemo(() => {
    const map = new Map<string, string>();
    usedColors.forEach((u) => map.set(normalize(u.color), u.cohortLabel));
    return map;
  }, [usedColors]);

  const selectedNorm = value ? normalize(value) : '';
  const customValid = isValidColor(custom);
  const previewColor = customValid ? custom.trim() : value ?? 'transparent';
  const wheelColor = useMemo(() => {
    const parsed = parseColor(custom);
    return parsed ? rgbToHex(parsed) : rgbToHex(parseColor(value ?? '#000000') ?? { r: 0, g: 0, b: 0 });
  }, [custom, value]);

  const applyCustom = useCallback(
    (hex: string, keepOpen = false) => {
      setCustom(hex);
      onSelect(hex, keepOpen);
    },
    [onSelect],
  );

  return (
    <div className={styles.picker}>
      <div className={`${styles.header} ${colorPickerDragHandle}`}>
        <span className={styles.headerTitle}>Cohort color</span>
        {onClose && (
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close color picker"
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
              const selected = norm === selectedNorm;
              return (
                <Swatch
                  key={color.value}
                  color={color.value}
                  selected={selected}
                  usedBy={usedMap.get(norm)}
                  onSelect={onSelect}
                />
              );
            })}
          </div>
        </div>
      ))}

      <div className={styles.section}>Custom</div>
      <div className={styles.selectedPreview}>
        <span
          className={styles.previewSwatch}
          style={{ background: previewColor }}
          aria-hidden
        />
        <span className={styles.previewLabel}>{customValid ? custom.trim() : value ?? '—'}</span>
      </div>
      <InlineColorWheel color={wheelColor} onChange={(hex) => applyCustom(hex, true)} />
      <div className={styles.customRow}>
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
