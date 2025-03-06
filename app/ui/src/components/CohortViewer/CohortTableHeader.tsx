import { FC, useState, useRef, useEffect } from 'react';
import styles from './CohortTableHeader.module.css';
import { CohortDataService } from './CohortDataService';
import { PhenotypeType, PhenotypeTypeNames } from '../../types/phenotype';

interface CohortTableHeaderProps {
  cohortName: string;
  dataService: CohortDataService;
  onCohortNameChange: (newValue: string) => void;
  onSaveChanges: () => void;
  onAddPhenotype: (type: string) => void;
}

export const CohortTableHeader: FC<CohortTableHeaderProps> = ({
  cohortName,
  dataService,
  onCohortNameChange,
  onSaveChanges,
  onAddPhenotype,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const phenotypeTypes = Object.values(PhenotypeType);

  return (
    <div className={styles.topSection}>
      <input
        type="text"
        className={styles.cohortNameInput}
        placeholder="Name your cohort..."
        value={cohortName}
        onChange={e => {
          const newValue = e.target.value;
          onCohortNameChange(newValue);
          dataService.cohort_name = newValue;
        }}
        onKeyDown={async e => {
          if (e.key === 'Enter') {
            onSaveChanges();
          }
        }}
      />
      <div className={styles.buttonsContainer}>
        <button className={styles.reportButton} onClick={() => console.log('Report clicked')}>
          Settings
        </button>
        <div className={styles.dropdownContainer} ref={dropdownRef}>
          <button
            className={styles.addPhenotypeButton}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            Add a Phenotype
          </button>
          {isDropdownOpen && (
            <div className={styles.dropdownMenu}>
              {phenotypeTypes.map(type => (
                <button
                  key={type}
                  className={styles.dropdownItem}
                  onClick={() => {
                    onAddPhenotype(type);
                    setIsDropdownOpen(false);
                  }}
                >
                  {PhenotypeTypeNames[type as PhenotypeType]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
