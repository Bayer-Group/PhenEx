import { useState, useEffect } from 'react';
import { MapperDomains, DomainInfo, Mapper } from '../types/mappers';
import { StudyDataService } from '../views/StudyViewer/StudyDataService';

/**
 * Custom hook to load and manage domain information based on the current mapper configuration.
 * 
 * This hook fetches the mapper from the StudyDataService (study-level database_config) and
 * returns the corresponding domains from the MapperDomains configuration.
 * 
 * @returns {Object} Object containing:
 *   - domains: Array of DomainInfo objects for the current mapper
 *   - mapper: Current mapper name (e.g., 'OMOP', 'Optum EHR')
 *   - isLoading: Boolean indicating if the data is still loading
 */
export const useDomains = () => {
  const [studyDataService] = useState(() => StudyDataService.getInstance());
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [mapper, setMapper] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDomains = () => {
      const currentMapper = studyDataService.database_config?.mapper as Mapper;
      
      if (currentMapper && currentMapper in MapperDomains) {
        setMapper(currentMapper);
        setDomains(MapperDomains[currentMapper]);
      }
      
      setIsLoading(false);
    };

    loadDomains();
    studyDataService.addStudyDataServiceListener(loadDomains);
    return () => { studyDataService.removeStudyDataServiceListener(loadDomains); };
  }, [studyDataService]);

  return { domains, mapper, isLoading };
};
