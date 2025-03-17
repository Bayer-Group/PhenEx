import { FC } from 'react';
import styles from './CohortDatabaseSettings.module.css';

interface SnowflakeConfig {
  sourceDb: string;
  destinationDb: string;
  user: string;
  account: string;
  warehouse: string;
  role: string;
  password: string;
}

interface SnowflakeConnectorFieldsProps {
  snowflakeConfig: SnowflakeConfig;
  onConfigChange: (config: SnowflakeConfig) => void;
  onSave: () => void;
}

export const SnowflakeConnectorFields: FC<SnowflakeConnectorFieldsProps> = ({
  snowflakeConfig,
  onConfigChange,
  onSave,
}) => {
  const handleChange = (field: keyof SnowflakeConfig, value: string) => {
    onConfigChange({
      ...snowflakeConfig,
      [field]: value,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave();
    }
  };

  return (
    <>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Source Database</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.sourceDb}
          onChange={e => handleChange('sourceDb', e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onSave}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Destination Database</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.destinationDb}
          onChange={e => handleChange('destinationDb', e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onSave}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>User</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.user}
          onChange={e => handleChange('user', e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onSave}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Account</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.account}
          onChange={e => handleChange('account', e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onSave}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Warehouse</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.warehouse}
          onChange={e => handleChange('warehouse', e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onSave}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Role</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.role}
          onChange={e => handleChange('role', e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onSave}
        />
      </div>
      <div className={styles.inputGroup + ' ' + styles.lastField}>
        <label className={styles.inputLabel}>Password</label>
        <input
          type="password"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.password}
          onChange={e => handleChange('password', e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onSave}
        />
      </div>
    </>
  );
};
