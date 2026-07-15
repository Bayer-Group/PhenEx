import { FC, useState, useEffect } from 'react';
import styles from './DatabaseFields.module.css';
import { StudyDataService } from '../../StudyViewer/StudyDataService';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import databasesDataRaw from '/assets/databases.json?raw';
const databasesData = JSON.parse(databasesDataRaw);

interface DatabaseFieldsProps {
  contentMode?: 'cohort' | 'study';
}

export const DatabaseFields: FC<DatabaseFieldsProps> = ({ contentMode = 'study' }) => {
  const studyDataService = StudyDataService.getInstance();
  const cohortDataService = CohortDataService.getInstance();

  const getCurrentConfig = () =>
    contentMode === 'cohort'
      ? (cohortDataService.database ?? {})
      : (studyDataService.database ?? {});

  const saveConfig = (config: Record<string, any>) =>
    contentMode === 'cohort'
      ? cohortDataService.setCohortDatabaseConfig(config)
      : studyDataService.setDatabaseConfig(config);

  const [selectedMapper, setSelectedMapper] = useState('');
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [selectedSchema, setSelectedSchema] = useState('');
  const [availableSchemas, setAvailableSchemas] = useState<string[]>([]);

  const updateConfig = () => {
    const cfg = getCurrentConfig();
    setSelectedMapper(cfg.mapper || '');

    // Restore Database/Schema selections from saved source_database
    const connector = cfg.connector;
    if (connector === 'mocker') {
      const dbConfig = databasesData.find(
        (db: any) => db.connector === 'mocker' &&
          (!cfg.config?.n_patients || db.n_patients === cfg.config.n_patients)
      );
      setSelectedDatabase(dbConfig?.database || '');
      setAvailableSchemas(dbConfig?.schemas || []);
      setSelectedSchema(dbConfig?.schemas?.[0] || '');
    } else if (cfg.config?.source_database?.includes('.')) {
      const [db, schema] = cfg.config.source_database.split('.');
      const dbConfig = databasesData.find((d: any) => d.database === db);
      if (dbConfig) {
        setSelectedDatabase(db);
        setAvailableSchemas(dbConfig.schemas);
        setSelectedSchema(dbConfig.schemas.includes(schema) ? schema : '');
      } else {
        setSelectedDatabase('');
        setSelectedSchema('');
        setAvailableSchemas([]);
      }
    } else {
      setSelectedDatabase('');
      setSelectedSchema('');
      setAvailableSchemas([]);
    }
  };

  useEffect(() => {
    updateConfig();
    if (contentMode === 'cohort') {
      cohortDataService.addListener(updateConfig);
      return () => cohortDataService.removeListener(updateConfig);
    } else {
      studyDataService.addStudyDataServiceListener(updateConfig);
      return () => studyDataService.removeStudyDataServiceListener(updateConfig);
    }
  }, [contentMode]);

  const handleDatabaseChange = (databaseName: string) => {
    setSelectedDatabase(databaseName);
    const dbConfig = databasesData.find((db: any) => db.database === databaseName);
    if (dbConfig) {
      setAvailableSchemas(dbConfig.schemas);
      setSelectedMapper(dbConfig.mapper);
      
      // Auto-select first schema and trigger save
      const firstSchema = dbConfig.schemas[0];
      if (firstSchema) {
        setSelectedSchema(firstSchema);
        
        // Save config immediately with the current database/schema values
        const mapper = dbConfig.mapper;
        const connector = dbConfig.connector || 'Snowflake';
        
        if (connector === 'mocker') {
          saveConfig({
            mapper,
            connector: 'mocker',
            config: { n_patients: dbConfig?.n_patients || 25000 },
          });
        } else {
          // For Snowflake: only store source_database
          // Auth credentials come from environment variables at execution time
          saveConfig({
            mapper,
            connector,
            config: {
              source_database: `${databaseName}.${firstSchema}`,
            },
          });
        }
      }
    } else {
      setSelectedSchema('');
      setAvailableSchemas([]);
    }
  };

  const handleSchemaChange = (schemaName: string) => {
    setSelectedSchema(schemaName);
    if (!selectedDatabase || !schemaName) return;

    const dbConfig = databasesData.find((db: any) => db.database === selectedDatabase);
    const connector = dbConfig?.connector || 'Snowflake';

    if (connector === 'mocker') {
      saveConfig({
        mapper: selectedMapper,
        connector: 'mocker',
        config: { n_patients: dbConfig?.n_patients || 25000 },
      });
    } else {
      // For Snowflake: only store source_database
      // Auth credentials come from environment variables at execution time
      saveConfig({
        mapper: selectedMapper,
        connector,
        config: {
          source_database: `${selectedDatabase}.${schemaName}`,
        },
      });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.section}>
        <div className={styles.inputFieldsGrid}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Database</label>
            <select
              className={styles.dropdown}
              value={selectedDatabase}
              onChange={e => handleDatabaseChange(e.target.value)}
            >
              <option value="">Select a database</option>
              {databasesData.map((db: any) => (
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
              {availableSchemas.map((schema: string) => (
                <option key={schema} value={schema}>
                  {schema}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
