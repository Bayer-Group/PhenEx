const ROMAN_MAP: ReadonlyArray<readonly [number, string]> = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];

function toRoman(n: number): string {
  let remaining = n;
  let result = '';
  for (const [value, numeral] of ROMAN_MAP) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

/** 1 → a, 26 → z, 27 → aa */
function toLetters(n: number): string {
  let remaining = n;
  let result = '';
  while (remaining > 0) {
    remaining -= 1;
    result = String.fromCharCode(97 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26);
  }
  return result;
}

/**
 * Display label for a hierarchical index: last segment only, styled by level.
 * Cycles every 3 levels: 1,2,3 → a,b,c → i,ii,iii → 1,2,3 → …
 */
export function formatHierarchicalIndexLabel(
  hierarchicalIndex: string | undefined | null,
  level = 0,
): string {
  if (!hierarchicalIndex) return '';

  const last = hierarchicalIndex.split('.').at(-1) ?? hierarchicalIndex;
  const n = Number(last);
  if (!Number.isFinite(n) || n < 1) return last;

  switch (Math.max(0, level) % 3) {
    case 1:
      return toLetters(n);
    case 2:
      return toRoman(n);
    default:
      return String(n);
  }
}
