/**
 * Represents a datetime boundary constraint.
 * min_value uses AfterOrOn (>=) or After (>).
 * max_value uses BeforeOrOn (<=) or Before (<).
 */
export interface DateConstraint {
  class_name: 'AfterOrOn' | 'After' | 'BeforeOrOn' | 'Before';
  operator: '>=' | '>' | '<=' | '<';
  value: { __datetime__: string };
  date_format: null;
}

/**
 * Represents an absolute date-range filter backed by a datetime column.
 * Maps to the Python ValueFilter class with datetime constraints.
 */
export interface DateRange {
  class_name: 'ValueFilter';
  min_value: DateConstraint | null;
  max_value: DateConstraint | null;
  column_name: string;
}
