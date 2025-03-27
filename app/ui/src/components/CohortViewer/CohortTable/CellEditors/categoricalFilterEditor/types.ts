export interface BaseCategoricalFilter {
  class_name: 'CategoricalFilter';
  column_name: string;
  allowed_values: (string | number)[];
  domain: string;
  status: string;
  id: string;
}

export interface AndFilter {
  class_name: 'AndFilter';
  filter1: FilterType;
  filter2: FilterType;
}

export interface OrFilter {
  class_name: 'OrFilter';
  filter1: FilterType;
  filter2: FilterType;
}

export type FilterType = BaseCategoricalFilter | AndFilter | OrFilter;
