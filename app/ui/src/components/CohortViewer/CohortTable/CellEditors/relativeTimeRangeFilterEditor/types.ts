/**
 * Represents a time range filter for cohort queries
 * Used to filter events based on their temporal relationship to an anchor point
 */
export interface TimeRangeFilter {
  /** Fixed class name identifier for the filter type */
  class_name: 'RelativeTimeRangeFilter';
  
  /** 
   * Minimum days constraint (null when 'not set') 
   * Defines the lower bound of the time range
   */
  min_days: {
    class_name: 'Value';
    operator: '>' | '>=' | 'not set';
    value: number | null;
  } | null;
  
  /** 
   * Maximum days constraint (null when 'not set')
   * Defines the upper bound of the time range
   */
  max_days: {
    class_name: 'Value';
    operator: '<' | '<=' | 'not set';
    value: number | null;
  } | null;
  
  /** Temporal relationship to the anchor point */
  when: 'before' | 'after' | 'range';
  
  /** Whether to use index date as anchor (true) or custom phenotype (false) */
  useIndexDate: boolean;
  
  /** Whether to use predefined constant ranges instead of manual configuration */
  useConstant: boolean;
  
  /** Custom phenotype to use as anchor when useIndexDate is false */
  anchor_phenotype: string | null;
  
  /** Predefined constant range option when useConstant is true */
  constant?: 'one_year_pre_index' | 'any_time_post_index';
}
