export interface SingleLogicalExpression {
  class_name: 'LogicalExpression';
  phenotype_name: string;
  phenotype_id: string;
  id: string;
  status?: 'empty' | 'filled';
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

export type FilterType = SingleLogicalExpression | AndFilter | OrFilter;
