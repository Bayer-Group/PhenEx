import { FC, useState } from 'react';
import styles from './CodelistsInfoDisplay.module.css';
// Try one of these import statements:

// If it's a default export:
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';

export const CodelistsInfoDisplay: FC = () => {
  const [dataService] = useState(() => CohortDataService.getInstance());

  return (
    <div className={styles.container}>
      <p>
        <span className={styles.number}>{dataService.codelists_service.getTotalCodes()}</span> codes
        in{' '}
        <span className={styles.number}>{dataService.codelists_service.getTotalCodelists()}</span>{' '}
        codelists. The code type in your database is ICD10CM, NDC. There is no punctuation the
        codelists!
      </p>
    </div>
  );
};
