import React, { useState, useEffect, useMemo } from 'react';
import styles from './RelativeTimeRangeFilterEditor.module.css';
import { TimeRangeFilter } from './types';
import { CohortDataService } from '../../../CohortDataService/CohortDataService';

interface SingleRelativeTimeRangeFilterEditorProps {
  value: TimeRangeFilter;
  onValueChange?: (value: TimeRangeFilter) => void;
}

// Constants for default values
const DEFAULT_MIN_DAYS = 0;
const DEFAULT_MAX_DAYS = 365;
const DEFAULT_WHEN = 'before';
const DEFAULT_MIN_OPERATOR = '>';
const DEFAULT_MAX_OPERATOR = '<';

/**
 * Safely converts string input to integer or null
 * Handles empty strings and invalid inputs gracefully
 */
const parseIntegerValue = (stringValue: string): number | null => {
  if (stringValue === '' || stringValue === null || stringValue === undefined) {
    return null;
  }
  const parsed = parseInt(stringValue, 10);
  return isNaN(parsed) ? null : parsed;
};

/**
 * Normalizes a filter by ensuring all required properties are present with defaults
 */
const normalizeFilter = (filter: TimeRangeFilter): TimeRangeFilter => ({
  class_name: 'RelativeTimeRangeFilter',
  min_days:
    filter.min_days === null
      ? null
      : {
          class_name: 'Value',
          operator: filter.min_days?.operator || DEFAULT_MIN_OPERATOR,
          value: filter.min_days?.value ?? DEFAULT_MIN_DAYS,
        },
  max_days:
    filter.max_days === null
      ? null
      : {
          class_name: 'Value',
          operator: filter.max_days?.operator || DEFAULT_MAX_OPERATOR,
          value: filter.max_days?.value ?? DEFAULT_MAX_DAYS,
        },
  when: filter.when || DEFAULT_WHEN,
  useConstant: filter.useConstant ?? false,
  useIndexDate: filter.useIndexDate ?? true,
  anchor_phenotype: filter.anchor_phenotype ?? null,
  constant: filter.constant,
});

/**
 * Creates a Value object for min/max days or returns null when operator is 'not set'
 */
const createValueObject = (
  operator: string,
  currentValue: { operator: string; value: number | null } | null,
  defaultValue: number
) => {
  if (operator === 'not set') {
    return null;
  }
  return {
    class_name: 'Value' as const,
    operator: operator as '>' | '>=' | '<' | '<=',
    value: currentValue?.value ?? defaultValue,
  };
};

export const SingleRelativeTimeRangeFilterEditor: React.FC<SingleRelativeTimeRangeFilterEditorProps> = ({
  value,
  onValueChange,
}) => {
  const [filter, setFilter] = useState<TimeRangeFilter>(() => normalizeFilter(value));
  
  // Get available constants of type RelativeTimeRangeFilter from the cohort data service
  const [availableConstants, setAvailableConstants] = useState<Record<string, any>>(() => {
    const dataService = CohortDataService.getInstance();
    if (!dataService.constants_service) return {};
    return dataService.constants_service.getConstantsOfType('RelativeTimeRangeFilter');
  });
  
  // Refresh constants when component mounts or when constants might have changed
  useEffect(() => {
    const dataService = CohortDataService.getInstance();
    if (dataService.constants_service) {
      const constants = dataService.constants_service.getConstantsOfType('RelativeTimeRangeFilter');
      setAvailableConstants(constants);
    }
  }, []); // Only run on mount

  // Notify parent component when filter changes
  useEffect(() => {
    if (onValueChange && filter !== value) {
      onValueChange(filter);
    }
  }, [filter, onValueChange, value]);

  /**
   * Updates the filter with partial changes while maintaining data integrity
   */
  const updateFilter = (updates: Partial<TimeRangeFilter>) => {
    const currentFilter = filter;

    const newFilter: TimeRangeFilter = {
      ...currentFilter,
      ...updates,
      class_name: 'RelativeTimeRangeFilter',
      // Handle min_days updates while preserving existing values
      min_days:
        updates.min_days === null
          ? null
          : updates.min_days
            ? { ...currentFilter.min_days, ...updates.min_days, class_name: 'Value' }
            : currentFilter.min_days,
      // Handle max_days updates while preserving existing values
      max_days:
        updates.max_days === null
          ? null
          : updates.max_days
            ? { ...currentFilter.max_days, ...updates.max_days, class_name: 'Value' }
            : currentFilter.max_days,
      // Preserve existing values with fallbacks
      useConstant: updates.useConstant ?? currentFilter.useConstant ?? false,
      constant: updates.constant ?? currentFilter.constant,
      useIndexDate: updates.useIndexDate ?? currentFilter.useIndexDate ?? true,
      anchor_phenotype: updates.anchor_phenotype ?? currentFilter.anchor_phenotype ?? null,
    };

    setFilter(newFilter);
  };

  /**
   * Handles operator change for min/max days, setting to null when 'not set'
   */
  const handleOperatorChange = (
    field: 'min_days' | 'max_days',
    operator: string
  ) => {
    const currentValue = filter[field];
    const defaultValue = field === 'min_days' ? DEFAULT_MIN_DAYS : DEFAULT_MAX_DAYS;

    const newValue = createValueObject(operator, currentValue, defaultValue);
    updateFilter({ [field]: newValue });
  };

  /**
   * Handles value changes for min/max days input fields
   */
  const handleValueChange = (
    field: 'min_days' | 'max_days',
    value: number | null
  ) => {
    const currentField = filter[field];

    if (currentField) {
      updateFilter({
        [field]: {
          class_name: 'Value',
          operator: currentField.operator,
          value,
        },
      });
    }
  };

  return (
    <div className={styles.manualContent}>
      <div className={styles.timerangefilter}>
        <UseConstantSection filter={filter} onUpdate={updateFilter} />

        {filter.useConstant ? (
          <ConstantSelector filter={filter} onUpdate={updateFilter} availableConstants={availableConstants} />
        ) : (
          <ManualTimeRangeControls
            filter={filter}
            onUpdate={updateFilter}
            onOperatorChange={handleOperatorChange}
            onValueChange={handleValueChange}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Use Constant checkbox section
 */
interface UseConstantSectionProps {
  filter: TimeRangeFilter;
  onUpdate: (updates: Partial<TimeRangeFilter>) => void;
}

const UseConstantSection: React.FC<UseConstantSectionProps> = ({ filter, onUpdate }) => (
  <div className={styles.filterSection}>
    <label>
      <input
        type="checkbox"
        checked={filter.useConstant}
        onChange={e => onUpdate({ useConstant: e.target.checked })}
      />
      Use Constant
    </label>
  </div>
);

/**
 * Constant value selector (when useConstant is true)
 */
interface ConstantSelectorProps {
  filter: TimeRangeFilter;
  onUpdate: (updates: Partial<TimeRangeFilter>) => void;
  availableConstants: Record<string, any>;
}

const ConstantSelector: React.FC<ConstantSelectorProps> = ({ filter, onUpdate, availableConstants }) => {
  const constantNames = Object.keys(availableConstants);
  const hasConstants = constantNames.length > 0;
  
  // Auto-select first constant if none selected (only when user first enables useConstant)
  const selectedConstant = filter.constant || (hasConstants ? constantNames[0] : '');
  
  if (!hasConstants) {
    return (
      <div className={styles.filterSection}>
        <p style={{ fontSize: '12px', opacity: 0.7 }}>
          No RelativeTimeRangeFilter constants available. Add constants in the Constants panel.
        </p>
      </div>
    );
  }
  
  return (
    <div className={styles.filterSection}>
      <select
        value={selectedConstant}
        onChange={e => onUpdate({ constant: e.target.value as TimeRangeFilter['constant'] })}
        className={styles.select}
      >
        {constantNames.map(name => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
};

/**
 * Manual time range controls (when useConstant is false)
 */
interface ManualTimeRangeControlsProps {
  filter: TimeRangeFilter;
  onUpdate: (updates: Partial<TimeRangeFilter>) => void;
  onOperatorChange: (field: 'min_days' | 'max_days', operator: string) => void;
  onValueChange: (field: 'min_days' | 'max_days', value: number | null) => void;
}

const ManualTimeRangeControls: React.FC<ManualTimeRangeControlsProps> = ({
  filter,
  onUpdate,
  onOperatorChange,
  onValueChange,
}) => (
  <>
    <DaysRangeSection
      label="Min Days"
      field="min_days"
      value={filter.min_days}
      operators={['>', '>=']}
      onOperatorChange={onOperatorChange}
      onValueChange={onValueChange}
      defaultValue={DEFAULT_MIN_DAYS}
    />

    <DaysRangeSection
      label="Max Days"
      field="max_days"
      value={filter.max_days}
      operators={['<', '<=']}
      onOperatorChange={onOperatorChange}
      onValueChange={onValueChange}
      defaultValue={DEFAULT_MAX_DAYS}
    />

    <WhenSection filter={filter} onUpdate={onUpdate} />

    <AnchorSection filter={filter} onUpdate={onUpdate} />
  </>
);

/**
 * Days range input section (min/max days)
 */
interface DaysRangeSectionProps {
  label: string;
  field: 'min_days' | 'max_days';
  value: { operator: string; value: number | null } | null;
  operators: string[];
  onOperatorChange: (field: 'min_days' | 'max_days', operator: string) => void;
  onValueChange: (field: 'min_days' | 'max_days', value: number | null) => void;
  defaultValue: number;
}

const DaysRangeSection: React.FC<DaysRangeSectionProps> = ({
  label,
  field,
  value,
  operators,
  onOperatorChange,
  onValueChange,
  defaultValue,
}) => (
  <div className={styles.filterSection}>
    <div className={styles.fieldLabel}>{label}:</div>
    <div className={styles.fieldInputs}>
      <select
        value={value?.operator || 'not set'}
        onChange={e => onOperatorChange(field, e.target.value)}
        className={`${styles.select} ${styles.operatorSelect}`}
      >
        <option value="not set">Not Set</option>
        {operators.map(op => (
          <option key={op} value={op}>
            {op === '>' ? '>' : op === '>=' ? '≥' : op === '<' ? '<' : '≤'}
          </option>
        ))}
      </select>
      {value && (
        <input
          type="number"
          value={value.value ?? ''}
          onChange={e => onValueChange(field, parseIntegerValue(e.target.value))}
          className={styles.input}
          placeholder={defaultValue.toString()}
        />
      )}
    </div>
  </div>
);

/**
 * When (before/after/range) selection section
 */
interface WhenSectionProps {
  filter: TimeRangeFilter;
  onUpdate: (updates: Partial<TimeRangeFilter>) => void;
}

const WhenSection: React.FC<WhenSectionProps> = ({ filter, onUpdate }) => (
  <div className={styles.filterSection}>
    <div className={styles.fieldLabel}>When:</div>
    <div className={styles.fieldInputs}>
      <select
        value={filter.when}
        onChange={e => onUpdate({ when: e.target.value as 'before' | 'after' | 'range' })}
        className={styles.select}
      >
        <option value="before">Before</option>
        <option value="after">After</option>
        <option value="range">Range</option>
      </select>
    </div>
  </div>
);

/**
 * Anchor (index date vs phenotype) selection section
 */
interface AnchorSectionProps {
  filter: TimeRangeFilter;
  onUpdate: (updates: Partial<TimeRangeFilter>) => void;
}

const AnchorSection: React.FC<AnchorSectionProps> = ({ filter, onUpdate }) => (
  <div className={styles.filterSection}>
    <label>
      <input
        type="checkbox"
        checked={filter.useIndexDate}
        onChange={e => onUpdate({ useIndexDate: e.target.checked })}
      />
      Index Date
    </label>
    {!filter.useIndexDate && (
      <select
        value={filter.anchor_phenotype || ''}
        onChange={e => onUpdate({ anchor_phenotype: e.target.value })}
        className={styles.select}
      >
        <option value="">Select Anchor Phenotype...</option>
        <option value="one">one</option>
        <option value="two">two</option>
        <option value="three">three</option>
      </select>
    )}
  </div>
);
