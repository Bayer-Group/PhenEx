import { colorConfig } from './data/barchartcolors';

/** Build COHORT_BASE_COLORS from the config. */
const palette = colorConfig.palette as Record<string, readonly [number, number, number]>;
export const COHORT_BASE_COLORS: string[] = colorConfig.cohortColorOrder.map((name) => {
  const [r, g, b] = palette[name];
  return `rgb(${r}, ${g}, ${b})`;
});
export const AVAILABLE_COLORS: string[] = Object.values(palette).map(([r, g, b]) => {
  return `rgb(${r}, ${g}, ${b})`;
});

/** Structured palettes for color picker display. */
export const COLOR_PALETTES = Object.entries(colorConfig.palettes).map(([name, colors]) => ({
  name,
  colors: Object.entries(colors).map(([colorName, [r, g, b]]) => ({
    name: colorName,
    value: `rgb(${r}, ${g}, ${b})`,
  })),
}));

/** Default quick-pick swatches for the two-color group ramp (distinct per tone). */
export const TWO_COLOR_START_SWATCHES: string[] = colorConfig.twoColorDefaults.start.map(
  ([r, g, b]) => `rgb(${r}, ${g}, ${b})`,
);
export const TWO_COLOR_END_SWATCHES: string[] = colorConfig.twoColorDefaults.end.map(
  ([r, g, b]) => `rgb(${r}, ${g}, ${b})`,
);

/**
 * Get the color for a selection, based on its cohort group index and
 * subcohort position within that group. Subcohorts fade in alpha.
 */
export function getCohortColor(
  groupIndex: number,
  subIndex: number,
  totalSubs: number,
): string {
  const base = COHORT_BASE_COLORS[groupIndex % COHORT_BASE_COLORS.length];
  if (totalSubs <= 1) return base;
  const alpha = 1.0 - (subIndex / totalSubs) * 0.65;
  const m = base.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return base;
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
}

// Keep COLORS for backward compat
export const COLORS = COHORT_BASE_COLORS;

// ── Group color config ───────────────────────────────────────────────────────

export type GroupColorMode = 'single' | 'two-color';

/** Which way around the hue wheel the two-color ramp travels. */
export type HueDirection = 'short' | 'long';

export interface GroupColorConfig {
  mode: GroupColorMode;
  /** The sole color in 'single' mode, or the start of the ramp in 'two-color'. */
  startColor: string;
  /** End of the ramp; only used in 'two-color' mode. */
  endColor?: string;
  /** Hue rotation direction for 'two-color' mode. Defaults to 'short'. */
  direction?: HueDirection;
}

// ── Lab / LCH color helpers (used only by generateGroupColors) ───────────────

function labLinearize(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function labDelinearize(c: number): number {
  const v = Math.max(0, Math.min(1, c));
  return Math.round((v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255);
}

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function labFInv(t: number): number {
  return t > 0.206897 ? t ** 3 : (t - 16 / 116) / 7.787;
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rl = labLinearize(r), gl = labLinearize(g), bl = labLinearize(b);
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  const z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;
  const fx = labF(x / 0.95047), fy = labF(y), fz = labF(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const x = labFInv(a / 500 + fy) * 0.95047;
  const y = labFInv(fy);
  const z = labFInv(fy - b / 200) * 1.08883;
  const r =  x * 3.2404542 - y * 1.5371385 - z * 0.4985314;
  const g = -x * 0.9692660 + y * 1.8760108 + z * 0.0415560;
  const bv = x * 0.0556434 - y * 0.2040259 + z * 1.0572252;
  return [labDelinearize(r), labDelinearize(g), labDelinearize(bv)];
}

/** Parse the RGB channels of a hex (#rgb/#rrggbb) or rgb()/rgba() color string. */
function parseRgbChannels(color: string): [number, number, number] | null {
  const c = color.trim();
  const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/(.)/g, '$1$1') : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

/** Lab → LCh: same lightness, chroma = radius, hue = angle in degrees [0, 360). */
function labToLch(L: number, a: number, b: number): [number, number, number] {
  const C = Math.hypot(a, b);
  const H = (Math.atan2(b, a) * 180) / Math.PI;
  return [L, C, (H + 360) % 360];
}

/** LCh → Lab: inverse of labToLch. */
function lchToLab(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  return [L, Math.cos(h) * C, Math.sin(h) * C];
}

/**
 * Signed hue delta from h1 to h2 (degrees), choosing the short or long arc
 * around the wheel — mirrors culori's fixupHueShorter / fixupHueLonger, which
 * is what learnui.design's palette generator uses.
 */
function hueDelta(h1: number, h2: number, direction: HueDirection): number {
  // Shortest signed delta in (-180, 180].
  let d = ((h2 - h1) % 360 + 540) % 360 - 180;
  if (direction === 'long' && d !== 0) d -= 360 * Math.sign(d);
  return d;
}

/**
 * Generate `count` color strings from a GroupColorConfig.
 *
 * - 'single':    alpha-fades startColor (fully opaque → 35% opacity), matching
 *                the default getCohortColor ramp.
 * - 'two-color': perceptually uniform LCh interpolation between startColor and
 *                endColor — lightness and chroma vary linearly while hue rotates
 *                the short or long way around the wheel. This is the algorithm
 *                learnui.design uses, and it yields far more visually equidistant
 *                palettes than linear Lab (a, b) interpolation, which dips through
 *                gray when the endpoints sit on opposite sides of the hue circle.
 */
export function generateGroupColors(config: GroupColorConfig, count: number): string[] {
  if (count === 0) return [];

  if (config.mode === 'two-color' && config.endColor) {
    const start = parseRgbChannels(config.startColor);
    const end = parseRgbChannels(config.endColor);
    if (start && end) {
      const [L1, C1, H1] = labToLch(...rgbToLab(...start));
      const [L2, C2, H2] = labToLch(...rgbToLab(...end));
      const dH = hueDelta(H1, H2, config.direction ?? 'short');
      return Array.from({ length: count }, (_, i) => {
        const t = count <= 1 ? 0 : i / (count - 1);
        const L = L1 + (L2 - L1) * t;
        const C = C1 + (C2 - C1) * t;
        const H = H1 + dH * t;
        const [r, g, bv] = labToRgb(...lchToLab(L, C, H));
        return `rgb(${r}, ${g}, ${bv})`;
      });
    }
  }

  // single: alpha-fade ramp
  const rgb = parseRgbChannels(config.startColor);
  if (!rgb) return Array(count).fill(config.startColor);
  const [r, g, b] = rgb;
  return Array.from({ length: count }, (_, i) => {
    if (count <= 1) return config.startColor;
    const alpha = 1.0 - (i / count) * 0.65;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  });
}

/** An active legend item: a selected cohort at a specific display index/color. */
export interface LegendSelection {
  kind?: 'cohort';
  /** Full cohort directory name (e.g. "cohort1_baseline__age_40_45") */
  cohortName: string;
  /** Index into COLORS */
  colorIndex: number;
  /** Index of the parent cohort group (for grouped coloring) */
  groupIndex: number;
  /** Index of subcohort within its group */
  subIndex: number;
  /** Total number of subcohorts in the group */
  totalSubs: number;
}

/**
 * Manual per-cohort color overrides, keyed by full cohort directory name.
 * This is the single source of truth for user-chosen colors; it is shared by
 * the cohort selector, the figure legend, and all charts so a cohort's color
 * is chosen once and shown everywhere.
 */
export type ColorOverrides = Record<string, string>;

/** Resolve the effective color for a cohort, honoring manual overrides. */
export function resolveCohortColor(
  cohortName: string,
  groupIndex: number,
  subIndex: number,
  totalSubs: number,
  overrides?: ColorOverrides,
): string {
  return overrides?.[cohortName] ?? getCohortColor(groupIndex, subIndex, totalSubs);
}

/** Resolve the effective color for a legend selection, honoring manual overrides. */
export function getSelectionColor(sel: LegendSelection, overrides?: ColorOverrides): string {
  return resolveCohortColor(sel.cohortName, sel.groupIndex, sel.subIndex, sel.totalSubs, overrides);
}

/** A spacer row in the legend: introduces vertical spacing between cohorts. */
export interface LegendSpacer {
  kind: 'spacer';
  /** Stable id for keying/drag operations. */
  id: string;
  /** Spacing magnitude (1-4); larger = more space. */
  size: 1 | 2 | 3 | 4;
  /** Optional label rendered in the bar chart at the spacer position. */
  label?: string;
}

/** An item in the ordered legend: either a cohort selection or a spacer. */
export type LegendItem = LegendSelection | LegendSpacer;

export function isSpacer(item: LegendItem): item is LegendSpacer {
  return (item as LegendSpacer).kind === 'spacer';
}

export function isCohortSelection(item: LegendItem): item is LegendSelection {
  return (item as LegendSpacer).kind !== 'spacer';
}

export const SPACER_SIZES: readonly (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];

/** Parsed cohort group: a parent cohort with its subcohorts. */
export interface CohortGroup {
  /** Parent cohort name (no __) */
  parent: string;
  /** Subcohort entries: label + full directory name */
  subcohorts: { label: string; fullName: string }[];
}

/** Parse a flat list of cohort directory names into grouped structure. */
export function parseCohortGroups(names: string[]): CohortGroup[] {
  const groupMap = new Map<string, { label: string; fullName: string }[]>();
  const order: string[] = [];

  for (const name of names) {
    const idx = name.indexOf('__');
    if (idx === -1) {
      // Parent cohort
      if (!groupMap.has(name)) {
        groupMap.set(name, []);
        order.push(name);
      }
      // Auto-add "main" as the first subcohort
      groupMap.get(name)!.unshift({ label: 'main', fullName: name });
    } else {
      const parent = name.substring(0, idx);
      const sub = name.substring(idx + 2);
      if (!groupMap.has(parent)) {
        groupMap.set(parent, [{ label: 'main', fullName: parent }]);
        order.push(parent);
      }
      groupMap.get(parent)!.push({ label: sub, fullName: name });
    }
  }

  return order.map((parent) => ({
    parent,
    subcohorts: groupMap.get(parent)!,
  }));
}

export interface Table1Row {
  Name: string;
  N: number;
  Pct: number;
  _level?: number;
  Mean?: number | null;
  STD?: number | null;
  Min?: number | null;
  P10?: number | null;
  P25?: number | null;
  Median?: number | null;
  P75?: number | null;
  P90?: number | null;
  Max?: number | null;
}

export interface KdeCurve {
  x: number[];
  y: number[];
}

/* ── Table2 (incidence rates) ──────────────────────────────────────── */

export interface Table2Row {
  Outcome: string;
  Time_Point: number;
  N_Events: number;
  N_Censored: number;
  Time_Under_Risk: number;
  Incidence_Rate: number;
  Incidence_Rate_Per_Patient_Month: number;
}

/* ── Time-to-event (Kaplan–Meier) ──────────────────────────────────── */

export interface TimeToEventRow {
  Outcome: string;
  Timeline: number;
  Survival_Probability: number;
  CI_Lower: number;
  CI_Upper: number;
  At_Risk: number;
  Events: number;
  Censored: number;
}

export interface CohortDescriptionEntry {
  display_name?: string | null;
  description?: string | null;
}

export type CohortDescriptions = Record<string, CohortDescriptionEntry>;

/**
 * Resolve the human-readable parent/sub label parts for a cohort name.
 *
 * Cohort names follow the convention `parentName__subName`; cohorts without
 * `__` are top-level cohorts with no sub-label.
 *
 * @param cohortName    Full cohort directory name (may contain `__`).
 * @param getDisplayName  Function mapping a raw name to its display override,
 *                        or `undefined` when no override exists.
 */
export function getCohortLabelParts(
  cohortName: string,
  getDisplayName: (name: string) => string | null | undefined,
): { parent: string; sub: string | null } {
  const idx = cohortName.indexOf('__');
  if (idx === -1) {
    return { parent: getDisplayName(cohortName) || cohortName, sub: null };
  }
  const parentName = cohortName.substring(0, idx);
  const subName = cohortName.substring(idx + 2);
  return {
    parent: getDisplayName(parentName) || parentName,
    sub: getDisplayName(cohortName) || subName,
  };
}

/* ── Reports ───────────────────────────────────────────────────────── */

export interface ReportRow {
  name: string;
  reporter: string;
  active_cohorts: string[];
}

export interface Report {
  report_id: string;
  display_name: string;
  type: string;
  description: string;
  rows: ReportRow[];
}

export interface ReportsPayload {
  reports: Report[];
}

export interface Table1Data {
  rows: Table1Row[];
  sections: Record<string, string[]>;
  kdes?: Record<string, KdeCurve>;
}

export interface CohortEntry {
  cohortName: string;
  data: Table1Data;
}

export interface ClassifiedRows {
  booleans: Table1Row[];
  categoricals: Record<string, { category: string; N: number; Pct: number }[]>;
  catOrder: string[];
  numerics: Table1Row[];
}

export interface CohortClassified {
  name: string;
  /** Human-friendly label from cohort descriptions, if available */
  displayName?: string;
  /** Index into COLORS (legacy) */
  ci: number;
  /** Resolved color string for this cohort */
  color: string;
  classified: ClassifiedRows;
  data: Table1Data;
}

/* ── Unified characteristic types ──────────────────────────────────── */

export type CharacteristicType = 'boolean' | 'categorical' | 'numeric';

/** Classify table1 rows into booleans, categoricals, and numerics. */
export function classifyRows(rows: Table1Row[]): ClassifiedRows {
  const booleans: Table1Row[] = [];
  const categoricals: Record<string, { category: string; N: number; Pct: number }[]> = {};
  const catOrder: string[] = [];
  const numerics: Table1Row[] = [];

  for (const row of rows) {
    if (row.Name === 'Cohort') continue;
    if (row._level && row._level > 0) continue;

    const eqIdx = row.Name.indexOf('=');
    if (eqIdx !== -1) {
      const pheno = row.Name.substring(0, eqIdx);
      const cat = row.Name.substring(eqIdx + 1);
      if (!categoricals[pheno]) {
        categoricals[pheno] = [];
        catOrder.push(pheno);
      }
      categoricals[pheno].push({ category: cat, N: row.N || 0, Pct: row.Pct || 0 });
    } else if (row.Mean != null && !isNaN(row.Mean)) {
      numerics.push(row);
    } else {
      booleans.push(row);
    }
  }

  return { booleans, categoricals, catOrder, numerics };
}
