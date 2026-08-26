import { useState, useEffect } from 'react';
import { MapperDomains, DomainInfo, Mapper } from '../types/mappers';
import { StudyDataService } from '../views/StudyViewer/StudyDataService';
import { CohortDataService } from '../views/CohortViewer/CohortDataService/CohortDataService';

/**
 * Custom hook to load and manage domain information based on the current mapper configuration.
 * 
 * This hook resolves the mapper from the active cohort's database first (cohort-level
 * database) and falls back to the StudyDataService (study-level database). It returns the
 * corresponding domains from the MapperDomains configuration and stays in sync with changes
 * to either service.
 * 
 * @returns {Object} Object containing:
 *   - domains: Array of DomainInfo objects for the current mapper
 *   - mapper: Current mapper name (e.g., 'OMOP', 'Optum EHR')
 *   - isLoading: Boolean indicating if the data is still loading
 */
export const useDomains = () => {
  const [studyDataService] = useState(() => StudyDataService.getInstance());
  const [cohortDataService] = useState(() => CohortDataService.getInstance());
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [mapper, setMapper] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDomains = () => {
      const currentMapper = (cohortDataService.database?.mapper ??
        studyDataService.database?.mapper) as Mapper;

      if (currentMapper && currentMapper in MapperDomains) {
        setMapper(currentMapper);
        setDomains(MapperDomains[currentMapper]);
      }

      setIsLoading(false);
    };

    loadDomains();
    studyDataService.addStudyDataServiceListener(loadDomains);
    cohortDataService.addListener(loadDomains);
    return () => {
      studyDataService.removeStudyDataServiceListener(loadDomains);
      cohortDataService.removeListener(loadDomains);
    };
  }, [studyDataService, cohortDataService]);

  return { domains, mapper, isLoading };
};
