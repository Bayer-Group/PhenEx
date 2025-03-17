export interface TimeRangeFilter {
  class_name: 'RelativeTimeRangeFilter';
  min_days: {
    class_name: 'Value';
    operator: '>' | '>=';
    value: number;
  };
  max_days: {
    class_name: 'Value';
    operator: '<' | '<=';
    value: number;
  };
  when: 'before' | 'after' | 'range';
  useIndexDate: boolean;
  useConstant: boolean;
  anchor_phenotype: string | null;
  constant?: 'one_year_pre_index' | 'any_time_post_index';
}