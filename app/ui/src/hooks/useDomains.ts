import { useState, useEffect } from 'react';
import { MapperDomains, DomainInfo, Mapper } from '../types/mappers';
import { CohortDataService } from '../views/CohortViewer/CohortDataService/CohortDataService';

/**
 * Custom hook to load and manage domain information based on the current mapper configuration.
 * 
 * This hook fetches the mapper from the CohortDataService and returns the corresponding
 * domains from the MapperDomains configuration.
 * 
 * @returns {Object} Object containing:
 *   - domains: Array of DomainInfo objects for the current mapper
 *   - mapper: Current mapper name (e.g., 'OMOP', 'Optum EHR')
 *   - isLoading: Boolean indicating if the data is still loading
 */
export const useDomains = () => {
  const [cohortDataService] = useState(() => CohortDataService.getInstance());
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [mapper, setMapper] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDomains = () => {
      const currentMapper = cohortDataService.cohort_data.database_config?.mapper as Mapper;
      
      if (currentMapper && currentMapper in MapperDomains) {
        setMapper(currentMapper);
        setDomains(MapperDomains[currentMapper]);
      }
      
      setIsLoading(false);
    };

    loadDomains();
  }, [cohortDataService.cohort_data.database_config?.mapper]);

  return { domains, mapper, isLoading };
};
