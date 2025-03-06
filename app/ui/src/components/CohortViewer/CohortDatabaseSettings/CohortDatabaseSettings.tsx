import { FC, useState, useEffect } from 'react';
import styles from './CohortDatabaseSettings.module.css';
import { FloatingActionMenu } from '../../FloatingActionMenu/FloatingActionMenu';
import { Mapper } from '../../../types/mappers';
import { CohortDataService } from '../CohortDataService';

interface CohortDatabaseSettingsProps {}

const mappers = Object.values(Mapper);
const connector_types = ['Snowflake', 'duckdb'];

const snowflakeDefaults = {
  user: 'default_user',
  account: 'default_account',
  warehouse: 'default_warehouse',
  role: 'default_role',
  password: 'default_password'
};

export const CohortDatabaseSettings: FC<CohortDatabaseSettingsProps> = () => {
  const dataService = CohortDataService.getInstance();
  const [existingConfig, setExistingConfig] = useState(dataService.cohort_data.database_config || {});

  const [selectedMapper, setSelectedMapper] = useState(existingConfig.mapper || mappers[0]);
  const [selectedConnector, setSelectedConnector] = useState(existingConfig.connector || connector_types[0]);
  const [duckDbPath, setDuckDbPath] = useState(
    existingConfig.config?.database_path || ''
  );
  const [snowflakeConfig, setSnowflakeConfig] = useState({
    sourceDb: existingConfig.config?.source_database || '',
    destinationDb: existingConfig.config?.destination_database || '',
    user: existingConfig.config?.user || snowflakeDefaults.user,
    account: existingConfig.config?.account || snowflakeDefaults.account,
    warehouse: existingConfig.config?.warehouse || snowflakeDefaults.warehouse,
    role: existingConfig.config?.role || snowflakeDefaults.role,
    password: existingConfig.config?.password || snowflakeDefaults.password
  });

  const updateConfig = () => {
    const newConfig = dataService.cohort_data.database_config || {};
    setExistingConfig(newConfig);
    setSelectedMapper(newConfig.mapper || mappers[0]);
    setSelectedConnector(newConfig.connector || connector_types[0]);
    setDuckDbPath(newConfig.config?.database_path || '');
    setSnowflakeConfig({
      sourceDb: newConfig.config?.source_database || '',
      destinationDb: newConfig.config?.destination_database || '',
      user: newConfig.config?.user || snowflakeDefaults.user,
      account: newConfig.config?.account || snowflakeDefaults.account,
      warehouse: newConfig.config?.warehouse || snowflakeDefaults.warehouse,
      role: newConfig.config?.role || snowflakeDefaults.role,
      password: newConfig.config?.password || snowflakeDefaults.password
    });
  };

  useEffect(() => {
    // Initial update
    updateConfig();

    // Subscribe to data service changes
    dataService.addListener(updateConfig);

    return () => {
      // Cleanup: remove listener when component unmounts
      dataService.removeListener(updateConfig);
    };
  }, [dataService.cohort_data]); // Add dependency on cohort_data

  const createDuckDbFields = () => (
    <div className={styles.inputGroup}>
      <label className={styles.inputLabel}>Database Path</label>
      <input
        type="text"
        className={styles.input}
        placeholder="undefined"
        value={duckDbPath}
        onChange={(e) => setDuckDbPath(e.target.value)}
      />
    </div>
  );

  const createSnowflakeConnectorFields = () => (
    <>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Source Database</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.sourceDb}
          onChange={(e) => setSnowflakeConfig({...snowflakeConfig, sourceDb: e.target.value})}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Destination Database</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.destinationDb}
          onChange={(e) => setSnowflakeConfig({...snowflakeConfig, destinationDb: e.target.value})}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>User</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.user}
          onChange={(e) => setSnowflakeConfig({...snowflakeConfig, user: e.target.value})}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Account</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.account}
          onChange={(e) => setSnowflakeConfig({...snowflakeConfig, account: e.target.value})}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Warehouse</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.warehouse}
          onChange={(e) => setSnowflakeConfig({...snowflakeConfig, warehouse: e.target.value})}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Role</label>
        <input
          type="text"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.role}
          onChange={(e) => setSnowflakeConfig({...snowflakeConfig, role: e.target.value})}
        />
      </div>
      <div className={styles.inputGroup}>
        <label className={styles.inputLabel}>Password</label>
        <input
          type="password"
          className={styles.input}
          placeholder="undefined"
          value={snowflakeConfig.password}
          onChange={(e) => setSnowflakeConfig({...snowflakeConfig, password: e.target.value})}
        />
      </div>
    </>
  );

  const handleSaveChanges = () => {
    const dataService = CohortDataService.getInstance();
    const databaseConfig = {
      mapper: selectedMapper,
      connector: selectedConnector,
      config: selectedConnector === 'duckdb' 
        ? { database_path: duckDbPath }
        : {
            source_database: snowflakeConfig.sourceDb,
            destination_database: snowflakeConfig.destinationDb,
            user: snowflakeConfig.user,
            account: snowflakeConfig.account,
            warehouse: snowflakeConfig.warehouse,
            role: snowflakeConfig.role,
            password: snowflakeConfig.password
          }
    };
    
    dataService.setDatabaseSettings(databaseConfig);
  };

  const renderConnectorFields = () => {
    return selectedConnector === 'duckdb' 
      ? createDuckDbFields()
      : createSnowflakeConnectorFields();
  };

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <h1 className={styles.sectionTitle}>Mappers</h1>
        <select
          className={styles.dropdown}
          value={selectedMapper}
          onChange={(e) => setSelectedMapper(e.target.value)}
        >
          {mappers.map((mapper) => (
            <option key={mapper} value={mapper}>
              {mapper}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.section}>
        <h1 className={styles.sectionTitle}>Connection</h1>
        <select
          className={styles.dropdown}
          value={selectedConnector}
          onChange={(e) => setSelectedConnector(e.target.value)}
        >
          {connector_types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <div className={styles.inputFields}>
          {renderConnectorFields()}
        </div>
      </div>

      <FloatingActionMenu
        buttonTitles={['Save Changes']}
        buttonActions={[handleSaveChanges]}
      />
    </div>
  );
};