import { FC, useState, useEffect } from 'react';
import styles from './DatabasePanel.module.css';
import { Mapper } from '../../types/mappers';
import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';
import { SnowflakeConnectorFields } from './SnowflakeConnectorFields';
import { DuckDbFields } from './DuckDbFields';
import editPencilIcon from '../../../../assets/icons/edit-pencil.svg';

interface DatabasePanelProps {}

const mappers = Object.values(Mapper);
const connector_types = ['Snowflake', 'duckdb'];

const snowflakeDefaults = {
  user: 'default_user',
  account: 'default_account',
  warehouse: 'default_warehouse',
  role: 'default_role',
  password: 'default_password',
};

export const DatabasePanel: FC<DatabasePanelProps> = () => {
  const dataService = CohortDataService.getInstance();
  const [existingConfig, setExistingConfig] = useState(
    dataService.cohort_data.database_config || {}
  );

  const [selectedMapper, setSelectedMapper] = useState(existingConfig.mapper || mappers[0]);
  const [selectedConnector, setSelectedConnector] = useState(
    existingConfig.connector || connector_types[0]
  );
  const [duckDbPath, setDuckDbPath] = useState(existingConfig.config?.database_path || '');
  const [snowflakeConfig, setSnowflakeConfig] = useState({
    sourceDb: existingConfig.config?.source_database || '',
    destinationDb: existingConfig.config?.destination_database || '',
    user: existingConfig.config?.user || snowflakeDefaults.user,
    account: existingConfig.config?.account || snowflakeDefaults.account,
    warehouse: existingConfig.config?.warehouse || snowflakeDefaults.warehouse,
    role: existingConfig.config?.role || snowflakeDefaults.role,
    password: existingConfig.config?.password || snowflakeDefaults.password,
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
      password: newConfig.config?.password || snowflakeDefaults.password,
    });
  };

  useEffect(() => {
    updateConfig();
    dataService.addListener(updateConfig);
    return () => {
      dataService.removeListener(updateConfig);
    };
  }, [dataService.cohort_data]);

  const handleSaveChanges = (key?: string, value?: any) => {
    const databaseConfig = {
      mapper: key === 'mapper' ? value : selectedMapper,
      connector: key === 'connector' ? value : selectedConnector,
      config:
        selectedConnector === 'duckdb'
          ? { database_path: key === 'database_path' ? value : duckDbPath }
          : {
              source_database: key === 'source_database' ? value : snowflakeConfig.sourceDb,
              destination_database:
                key === 'destination_database' ? value : snowflakeConfig.destinationDb,
              user: key === 'user' ? value : snowflakeConfig.user,
              account: key === 'account' ? value : snowflakeConfig.account,
              warehouse: key === 'warehouse' ? value : snowflakeConfig.warehouse,
              role: key === 'role' ? value : snowflakeConfig.role,
              password: key === 'password' ? value : snowflakeConfig.password,
            },
    };

    dataService.setDatabaseSettings(databaseConfig);
  };

  const renderConnectorFields = () => {
    return selectedConnector === 'duckdb' ? (
      <DuckDbFields
        duckDbPath={duckDbPath}
        onPathChange={setDuckDbPath}
        onSave={handleSaveChanges}
      />
    ) : (
      <SnowflakeConnectorFields
        snowflakeConfig={snowflakeConfig}
        onConfigChange={setSnowflakeConfig}
        onSave={handleSaveChanges}
      />
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <div className={styles.inputFields}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Mapper</label>
            <select
              className={styles.dropdown}
              value={selectedMapper}
              onChange={e => {
                const newValue = e.target.value;
                setSelectedMapper(newValue);
                handleSaveChanges('mapper', newValue);
              }}
            >
              {mappers.map(mapper => (
                <option key={mapper} value={mapper}>
                  {mapper}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Connector</label>
            <select
              className={styles.dropdown}
              value={selectedConnector}
              onChange={e => {
                setSelectedConnector(e.target.value);
                handleSaveChanges('connector', e.target.value);
              }}
            >
              {connector_types.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          {renderConnectorFields()}
        </div>
      </div>
    </div>
  );
};
