import { FC, useState, useEffect } from 'react';
import styles from './DatabaseFields.module.css';
import { Mapper } from '../../../types/mappers';
import { StudyDataService } from '../../StudyViewer/StudyDataService';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import { SnowflakeConnectorFields } from './SnowflakeConnectorFields';
import { DuckDbFields } from './DuckDbFields';
import editPencilIcon from '../../../../../assets/icons/edit-pencil.svg';
import databasesDataRaw from '/assets/databases.json?raw';
let databasesData = JSON.parse(databasesDataRaw);

export enum DatabaseTabTypes {
  Default = 'Default',
  Manual = 'Manual',
}

interface DatabaseFieldsProps {
  mode: DatabaseTabTypes;
  contentMode?: 'cohort' | 'study';
}

const mappers = Object.values(Mapper);
const connector_types = ['Snowflake', 'duckdb'];

const snowflakeDefaults = {
  user: 'default_user',
  account: 'default_account',
  warehouse: 'default_warehouse',
  role: 'default_role',
  password: 'default_password',
};

export const DatabaseFields: FC<DatabaseFieldsProps> = ({ mode, contentMode = 'study' }) => {
  const studyDataService = StudyDataService.getInstance();
  const cohortDataService = CohortDataService.getInstance();

  const getCurrentConfig = () => contentMode === 'cohort'
    ? (cohortDataService.database_config ?? {})
    : (studyDataService.database_config ?? {});

  const saveConfig = (config: Record<string, any>) => contentMode === 'cohort'
    ? cohortDataService.setCohortDatabaseConfig(config)
    : studyDataService.setDatabaseConfig(config);

  const [existingConfig, setExistingConfig] = useState(
    getCurrentConfig()
  );

  const [selectedMapper, setSelectedMapper] = useState(existingConfig.mapper || mappers[0]);
  const [selectedConnector, setSelectedConnector] = useState(
    existingConfig.connector || connector_types[0]
  );
  const [duckDbPath, setDuckDbPath] = useState(existingConfig.config?.database_path || '');
  
  // State for default database selection
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);

  const createDefaultDestinationDb = () => {
    return `IEG_PROJECTS.PXUI_${studyDataService.study_data?.id ?? cohortDataService.cohort_data?.id ?? 'id'}`;
  };

  const [snowflakeConfig, setSnowflakeConfig] = useState({
    sourceDb: existingConfig.config?.source_database || '',
    destinationDb: existingConfig.config?.destination_database || createDefaultDestinationDb(),
    user: existingConfig.config?.user || snowflakeDefaults.user,
    account: existingConfig.config?.account || snowflakeDefaults.account,
    warehouse: existingConfig.config?.warehouse || snowflakeDefaults.warehouse,
    role: existingConfig.config?.role || snowflakeDefaults.role,
    password: existingConfig.config?.password || snowflakeDefaults.password,
  });

  const updateConfig = () => {
    const newConfig = getCurrentConfig();
    
    setExistingConfig(newConfig);
    setSelectedMapper(newConfig.mapper || mappers[0]);
    setSelectedConnector(newConfig.connector || connector_types[0]);
    setDuckDbPath(newConfig.config?.database_path || '');
    const destinationDb = newConfig.config?.destination_database || createDefaultDestinationDb();

    setSnowflakeConfig({
      sourceDb: newConfig.config?.source_database || '',
      destinationDb: destinationDb,
      user: newConfig.config?.user || snowflakeDefaults.user,
      account: newConfig.config?.account || snowflakeDefaults.account,
      warehouse: newConfig.config?.warehouse || snowflakeDefaults.warehouse,
      role: newConfig.config?.role || snowflakeDefaults.role,
      password: newConfig.config?.password || snowflakeDefaults.password,
    });

    // If destination database was auto-generated and we have a Snowflake connector, save it
    if (!newConfig.config?.destination_database && newConfig.connector === 'Snowflake') {
      const updatedConfig = {
        ...newConfig,
        config: { ...newConfig.config, destination_database: destinationDb },
      };
      saveConfig(updatedConfig);
    }

    // Parse source_database to set default database and schema selections
    const sourceDb = newConfig.config?.source_database;

    if (newConfig.connector === 'mocker') {
      // Mocker: find the matching database entry by n_patients
      const n_patients = newConfig.config?.n_patients;
      const dbConfig = databasesData.find((db: any) =>
        db.connector === 'mocker' && (!n_patients || db.n_patients === n_patients)
      );
      if (dbConfig) {
        setSelectedDatabase(dbConfig.database);
        setAvailableSchemas(dbConfig.schemas || []);
        setSelectedSchema(dbConfig.schemas?.[0] || '');
      } else {
        setSelectedDatabase('');
        setSelectedSchema('');
        setAvailableSchemas([]);
      }
    } else if (sourceDb && sourceDb.includes('.')) {
      const [database, schema] = sourceDb.split('.');
      console.log('🚨 Parsed database:', database, 'schema:', schema);
      
      // Check if this database exists in our databases data
      const dbConfig = databasesData.find(db => db.database === database);
      if (dbConfig) {
        console.log('🚨 Setting selectedDatabase to:', database);
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
        console.log('🚨 Database not found in defaults, resetting');
        setSelectedDatabase('');
        setSelectedSchema('');
        setAvailableSchemas([]);
      }
    } else if (sourceDb) {
      // Source database exists but doesn't contain a dot (invalid format)
      console.log('🚨 Invalid sourceDb format, switching to Manual');
      setSelectedDatabase('');
      setSelectedSchema('');
      setAvailableSchemas([]);
    } else {
      // No valid source_database, reset selections
      console.log('🚨 No valid sourceDb, resetting to defaults');
      setSelectedDatabase('');
      setSelectedSchema('');
      setAvailableSchemas([]);
    }
  };

  useEffect(() => {
    updateConfig();
    if (contentMode === 'cohort') {
      cohortDataService.addListener(updateConfig);
      return () => { cohortDataService.removeListener(updateConfig); };
    } else {
      studyDataService.addStudyDataServiceListener(updateConfig);
      return () => { studyDataService.removeStudyDataServiceListener(updateConfig); };
    }
  }, [contentMode]);

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

    saveConfig(databaseConfig);
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
        <div className={styles.inputFieldsGrid}>
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
      console.log('🔥 handleDatabaseChange called with:', databaseName);
      console.log('🔥 Current selectedDatabase before update:', selectedDatabase);
      
      setSelectedDatabase(databaseName);
      setSelectedSchema(''); // Reset schema selection
      
      // Find the selected database object
      const dbConfig = databasesData.find(db => db.database === databaseName);
      console.log('🔥 Found dbConfig:', dbConfig);
      
      if (dbConfig) {
        setAvailableSchemas(dbConfig.schemas);
        
        // Set mapper based on the database config
        const newMapper = dbConfig.mapper;
        setSelectedMapper(newMapper);
        
        // Set connector based on the database config (default to Snowflake)
        const newConnector = dbConfig.connector || 'Snowflake';
        setSelectedConnector(newConnector);
        
        // Set destination database if not already set
        const destinationDb = snowflakeConfig.destinationDb || createDefaultDestinationDb();
        
        // Update local state but don't save to dataService yet
        // Wait until schema is also selected
        setSnowflakeConfig(prev => ({
          ...prev,
          sourceDb: '', // Clear sourceDb until schema is selected
          destinationDb: destinationDb
        }));
        
        console.log('🔥 Database selected, waiting for schema selection before saving');
      }
    };

    const handleSchemaChange = (schemaName: string) => {
      setSelectedSchema(schemaName);
      
      if (selectedDatabase && schemaName) {
        const dbConfig = databasesData.find(db => db.database === selectedDatabase);
        const connectorForDb = dbConfig?.connector || 'Snowflake';

        if (connectorForDb === 'mocker') {
          // Mocker connector: save a minimal config with n_patients
          const databaseConfig = {
            mapper: selectedMapper,
            connector: 'mocker',
            config: {
              n_patients: dbConfig?.n_patients || 25000,
            },
          };
          saveConfig(databaseConfig);
        } else {
          // Set the sourceDb as database.schema
          const sourceDb = `${selectedDatabase}.${schemaName}`;
          
          // Set destination database if not already set
          const destinationDb = snowflakeConfig.destinationDb || createDefaultDestinationDb();

          setSnowflakeConfig(prev => ({
            ...prev,
            sourceDb: sourceDb,
            destinationDb: destinationDb
          }));
          
          // Save both source and destination database
          const databaseConfig = {
            mapper: selectedMapper,
            connector: selectedConnector,
            config: {
              source_database: sourceDb,
              destination_database: destinationDb,
              user: snowflakeConfig.user,
              account: snowflakeConfig.account,
              warehouse: snowflakeConfig.warehouse,
              role: snowflakeConfig.role,
              password: snowflakeConfig.password,
            },
          };
          
          saveConfig(databaseConfig);
        }
      }
    };

    return (
      <div className={styles.section}>
        <div className={styles.inputFieldsGrid}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Database</label>
            <select
              className={styles.dropdown}
              value={selectedDatabase}
              onChange={e => {
                handleDatabaseChange(e.target.value);
              }}
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

  return (
    <div className={styles.container}>
      {mode === DatabaseTabTypes.Manual && renderManualEntry()}
      {mode === DatabaseTabTypes.Default && renderDefaults()}
    </div>
  );
};
