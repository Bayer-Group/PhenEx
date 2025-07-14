/**
 * Represents a value constraint with operator and numeric value
 * Used for min/max value filtering in cohort queries
 */
export interface Value {
  /** Fixed class name identifier for the value type */
  class_name: 'Value';
  /** Comparison operator - 'not set' indicates no constraint */
  operator: '>' | '>=' | '<' | '<=' | 'not set';
  /** Numeric value for comparison (null when operator is 'not set') */
  value: number | null;
}

/**
 * Represents a filter for numeric values with optional min/max constraints
 * Used to filter data based on column values within specified ranges
 */
export interface ValueFilter {
  /** Fixed class name identifier for the filter type */
  class_name: 'ValueFilter';
  /** Minimum value constraint (null when not set) */
  min_value: Value | null;
  /** Maximum value constraint (null when not set) */
  max_value: Value | null;
  /** Name of the column to filter on */
  column_name: string;
}

/**
 * Represents a logical AND combination of two value filters
 * Used when multiple value constraints need to be applied together
 */
export interface AndFilter {
  /** Fixed class name identifier for the AND filter type */
  class_name: 'AndFilter';
  /** First value filter in the AND operation */
  filter1: ValueFilter;
  /** Second value filter in the AND operation */
  filter2: ValueFilter;
}
