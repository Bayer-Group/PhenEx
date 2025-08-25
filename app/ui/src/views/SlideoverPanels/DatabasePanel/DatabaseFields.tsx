import { FC, useState, useEffect } from 'react';
import styles from './DatabaseFields.module.css';
import { Mapper } from '../../../types/mappers';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { SnowflakeConnectorFields } from './SnowflakeConnectorFields';
import { DuckDbFields } from './DuckDbFields';
import editPencilIcon from '../../../../../assets/icons/edit-pencil.svg';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';
import databasesData from '../../../assets/databases.json';

interface DatabaseFieldsProps {}

const mappers = Object.values(Mapper);
const connector_types = ['Snowflake', 'duckdb'];

const snowflakeDefaults = {
  user: 'default_user',
  account: 'default_account',
  warehouse: 'default_warehouse',
  role: 'default_role',
  password: 'default_password',
};

enum DatabaseTabTypes {
  Default = 'Default',
  Manual = 'Manual',
}


export const DatabaseFields: FC<DatabaseFieldsProps> = () => {
  const dataService = CohortDataService.getInstance();
  const [existingConfig, setExistingConfig] = useState(
    dataService.cohort_data.database_config || {}
  );
  const tabs = Object.values(DatabaseTabTypes).map(value => value.charAt(0) + value.slice(1));
  const [currentTab, setCurrentTab] = useState<DatabaseTabTypes>(DatabaseTabTypes.Default);

  const [selectedMapper, setSelectedMapper] = useState(existingConfig.mapper || mappers[0]);
  const [selectedConnector, setSelectedConnector] = useState(
    existingConfig.connector || connector_types[0]
  );
  const [duckDbPath, setDuckDbPath] = useState(existingConfig.config?.database_path || '');
  
  // State for default database selection
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);
  
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

    // Parse source_database to set default database and schema selections
    const sourceDb = newConfig.config?.source_database;
    if (sourceDb && sourceDb.includes('.')) {
      const [database, schema] = sourceDb.split('.');
      
      // Check if this database exists in our databases data
      const dbConfig = databasesData.find(db => db.database === database);
      if (dbConfig) {
        setSelectedDatabase(database);
        setAvailableSchemas(dbConfig.schemas);
        
        // Check if the schema exists in the available schemas
        if (dbConfig.schemas.includes(schema)) {
          setSelectedSchema(schema);
        } else {
          setSelectedSchema('');
        }
      } else {
        // Database not found in defaults, reset selections
        setSelectedDatabase('');
        setSelectedSchema('');
        setAvailableSchemas([]);
      }
    } else {
      // No valid source_database, reset selections
      setSelectedDatabase('');
      setSelectedSchema('');
      setAvailableSchemas([]);
    }
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

  const renderManualEntry = () => {
    return (
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
    );
  }

  const renderDefaults = () => {
    const handleDatabaseChange = (databaseName: string) => {
      setSelectedDatabase(databaseName);
      setSelectedSchema(''); // Reset schema selection
      
      // Find the selected database object
      const dbConfig = databasesData.find(db => db.database === databaseName);
      if (dbConfig) {
        setAvailableSchemas(dbConfig.schemas);
        
        // Set mapper based on the database config
        const newMapper = dbConfig.mapper;
        setSelectedMapper(newMapper);
        
        // Set connector to Snowflake
        const newConnector = 'Snowflake';
        setSelectedConnector(newConnector);
        
        // Create and save the complete database config
        const databaseConfig = {
          mapper: newMapper,
          connector: newConnector,
          config: {
            source_database: snowflakeConfig.sourceDb,
            destination_database: snowflakeConfig.destinationDb,
            user: snowflakeConfig.user,
            account: snowflakeConfig.account,
            warehouse: snowflakeConfig.warehouse,
            role: snowflakeConfig.role,
            password: snowflakeConfig.password,
          },
        };
        
        dataService.setDatabaseSettings(databaseConfig);
      }
    };

    const handleSchemaChange = (schemaName: string) => {
      setSelectedSchema(schemaName);
      
      if (selectedDatabase && schemaName) {
        // Set the sourceDb as database.schema
        const sourceDb = `${selectedDatabase}.${schemaName}`;
        setSnowflakeConfig(prev => ({
          ...prev,
          sourceDb: sourceDb
        }));
        handleSaveChanges('source_database', sourceDb);
      }
    };

    return (
      <div className={styles.section}>
        <div className={styles.inputFields}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Database</label>
            <select
              className={styles.dropdown}
              value={selectedDatabase}
              onChange={e => handleDatabaseChange(e.target.value)}
            >
              <option value="">Select a database</option>
              {databasesData.map(db => (
                <option key={db.database} value={db.database}>
                  {db.database}
                </option>
              ))}
            </select>
          </div>
          
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Schema</label>
            <select
              className={styles.dropdown}
              value={selectedSchema}
              onChange={e => handleSchemaChange(e.target.value)}
              disabled={!selectedDatabase}
            >
              <option value="">Select a schema</option>
              {availableSchemas.map(schema => (
                <option key={schema} value={schema}>
                  {schema}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  };

  const onTabChange = (index: number) => {
    const tabTypes = Object.values(DatabaseTabTypes);
    setCurrentTab(tabTypes[index]);
  };

  return (
    <div className={styles.container}>
       <Tabs
        width={200}
        height={25}
        tabs={tabs}
        onTabChange={onTabChange}
        active_tab_index={-1}
        />
      {currentTab === DatabaseTabTypes.Manual && renderManualEntry()}
      {currentTab === DatabaseTabTypes.Default && renderDefaults()}
    </div>
  );
};
