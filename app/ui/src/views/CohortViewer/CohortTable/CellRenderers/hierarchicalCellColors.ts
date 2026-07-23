/**
 * Utility function to calculate alpha value based on hierarchical_index depth
 * Used across all cell renderers for consistent hierarchical styling
 */
export const getAlphaForLevel = (hierarchicalIndex: string | undefined): string => {
  if (!hierarchicalIndex) return '33'; // Default dim alpha (hex: 33 ≈ 0.2)
  const depth = hierarchicalIndex.split('.').length;
  // Level 1: 33 (0.2), Level 1.1: 20 (0.125), Level 1.1.1: 10 (0.06)
  if (depth === 1) return '25';
  if (depth === 2) return '15';
  if (depth === 3) return '10';
  return '08'; // For deeper levels
};

/**
 * Utility function to generate background color with hierarchical alpha
 * Uses CSS color-mix to blend type color with transparent based on depth
 */
export const getHierarchicalBackgroundColor = (
  effectiveType: string | undefined,
  hierarchicalIndex: string | undefined
): string | undefined => {
  if (!effectiveType) return undefined;

  const alpha = getAlphaForLevel(hierarchicalIndex);
  const colorVar = `--color_${effectiveType}`;

  // Use CSS custom property with hierarchical alpha
  return `color-mix(in srgb, var(${colorVar}) ${parseInt(alpha, 16) / 255 * 100}%, transparent)`;
};
