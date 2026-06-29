import { FC } from 'react';
import { SwitchButton } from '../../../components/ButtonsAndTabs/SwitchButton/SwitchButton';
import { type ColumnKey, type ColumnConfig } from './RowRenderers/AttritionTableCellRenderer';
import styles from './AttritionControls.module.css';

const COLUMN_SWITCH_KEYS: ColumnKey[] = ['pctSource', 'remaining', 'delta', 'pctEntry'];

const DARK_SWITCH_PROPS = {
  classNameLabel: styles.switchLabel,
  classNameSwitchBackground: styles.switchTrackOff,
  classNameSwitchThumb: styles.switchThumb,
  classNameSwitchBackgroundSelected: styles.switchTrackOn,
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
      <SwitchButton
        label="Hide main cohort rows"
        value={hideMainCohortRows}
        onValueChange={onHideMainCohortRowsChange}
        classNameSwitchContainer={styles.switch}
        {...DARK_SWITCH_PROPS}
      />
      <div className={styles.divider} />
      {COLUMN_SWITCH_KEYS.map((key) => {
        const col = columns.find((c) => c.key === key);
        if (!col) return null;
        return (
          <SwitchButton
            key={key}
            label={col.label}
            value={isVisible(key)}
            onValueChange={() => toggleColumn(key)}
            classNameSwitchContainer={styles.switch}
            {...DARK_SWITCH_PROPS}
          />
        );
      })}
    </div>
  );
};
