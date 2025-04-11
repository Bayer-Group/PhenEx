export interface Value {
  class_name: 'Value';
  operator: '>' | '>=' | '<' | '<=';
  value: number | null;
}

export interface ValueFilter {
  class_name: 'ValueFilter';
  min: Value | null;
  max: Value | null;
  column_name: string;
}

export interface AndFilter {
  class_name: 'AndFilter';
  filter1: ValueFilter;
  filter2: ValueFilter;
}
