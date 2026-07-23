import { FC } from 'react';
import { SwitchButton } from '../../../components/ButtonsAndTabs/SwitchButton/SwitchButton';
import { type ColumnKey, type ColumnConfig } from './RowRenderers/AttritionTableCellRenderer';
import styles from './AttritionControls.module.css';

const COLUMN_SWITCH_KEYS: ColumnKey[] = ['pctSource', 'remaining', 'delta', 'pctEntry'];
const COLUMNS_SWITCH_LABELS: Partial<Record<ColumnKey, string>> = {
  pctSource: 'Show how many patients are in the entire source database',
  remaining: 'Display the traditional attrition or waterfall number i.e. how many patients remain after applying each row inclusion/exclusion criteria sequentially. Percentages are displayed as percent of entry criterion.',
  delta: 'Show the number of patients lost when applying the criterium on that row seqentially.',
  pctEntry: 'Display frequency counts for individual rows with no sequential application of criteria. Percentages are displayed as percent of entry criterion size.',
};

const HIDE_MAIN_COHORT_DESCRIPTION =
  'Subcohorts (aka cohort stratifications) share the entry and all inclusion/exclusion criteria of the main cohort. These rows are displayed in the color of the main cohort. Click to hide or display.';

const DARK_SWITCH_PROPS = {
  classNameLabel: styles.switchLabel,
  classNameSwitchBackground: styles.switchBackground,
  classNameSwitchThumb: styles.switchThumb,
  classNameSwitchBackgroundSelected: styles.switchBackgroundSelected,
  classNameSwitch: styles.switchNotSelected,
  classNameSwitchSelected: styles.switchSelected,

} as const;

interface AttritionControlsProps {
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  hideMainCohortRows: boolean;
  onHideMainCohortRowsChange: (value: boolean) => void;
}

export const AttritionControls: FC<AttritionControlsProps> = ({
  columns,
  onColumnsChange,
  hideMainCohortRows,
  onHideMainCohortRowsChange,
}) => {
  function toggleColumn(key: ColumnKey) {
    onColumnsChange(
      columns.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)),
    );
  }

  function isVisible(key: ColumnKey): boolean {
    return columns.find((c) => c.key === key)?.visible ?? true;
  }

  return (
    <div className={styles.controls}>
      <div className={styles.switchRow}>
        <SwitchButton
          label="Hide main cohort rows"
          value={hideMainCohortRows}
          onValueChange={onHideMainCohortRowsChange}
          classNameSwitchContainer={styles.switch}
          {...DARK_SWITCH_PROPS}
        />
        <p className={styles.description}>{HIDE_MAIN_COHORT_DESCRIPTION}</p>
      </div>
      <div className={styles.divider} />
      {COLUMN_SWITCH_KEYS.map((key) => {
        const col = columns.find((c) => c.key === key);
        if (!col) return null;
        return (
          <div key={key} className={styles.switchRow}>
            <SwitchButton
              label={col.label}
              value={isVisible(key)}
              onValueChange={() => toggleColumn(key)}
              classNameSwitchContainer={styles.switch}
              {...DARK_SWITCH_PROPS}
            />
            <p className={styles.description}>{COLUMNS_SWITCH_LABELS[key]}</p>
          </div>
        );
      })}
    </div>
  );
};
