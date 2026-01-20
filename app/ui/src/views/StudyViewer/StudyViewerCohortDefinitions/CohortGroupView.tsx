import React from 'react';
import { CohortWithTableData } from './StudyViewerCohortDefinitionsTypes';
import { CohortCardLightWeight } from './CohortCardLightWeight';
import styles from './CohortGroupView.module.css';

interface CohortGroupViewProps {
  cohortDefinitions: CohortWithTableData[];
  onCardClick: (cohortDef: CohortWithTableData) => void;
  tableContainerRefs: React.MutableRefObject<Map<string | number, React.RefObject<HTMLDivElement | null>>>;
  onCellValueChanged: (cohortId: string, rowIndex: number, field: string, value: any) => Promise<void>;
  studyDataService: any;
  isDragging: boolean;
  isScrolling: boolean;
  isShiftPressed: boolean;
  isCommandPressed: boolean;
}

// Memoized view component to prevent re-renders during zoom/pan
export const CohortGroupView = React.memo<CohortGroupViewProps>(({
  cohortDefinitions,
  onCardClick,
  tableContainerRefs,
  onCellValueChanged,
  studyDataService,
  isDragging,
  isScrolling,
  isShiftPressed,
  isCommandPressed,
}) => {
  return (
    <div
        className={styles.cohortGroupView}
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '40px',
        padding: '20px',
        pointerEvents: 'none'
      }}
    >
      {cohortDefinitions.map((cohortDef, index) => {
        const cohortKey = cohortDef.cohort.id || index;
        const cohortId = cohortDef.cohort.id || String(index);
        
        // Get or create ref for this cohort's card container
        if (!tableContainerRefs.current.has(cohortKey)) {
          tableContainerRefs.current.set(cohortKey, React.createRef<HTMLDivElement>());
        }

        return (
            <div className={styles.cohortCardContainer} key={cohortKey} ref={tableContainerRefs.current.get(cohortKey)}>
            <CohortCardLightWeight
                key={cohortKey}
                cohortDef={cohortDef}
                cohortId={cohortId}
                studyDataService={studyDataService}
                onCardClick={onCardClick}
                onCellValueChanged={onCellValueChanged}
                isDragging={isDragging}
                isScrolling={isScrolling}
                isShiftPressed={isShiftPressed}
                isCommandPressed={isCommandPressed}
            />
          </div>
        );
      })}
    </div>
  );
});

CohortGroupView.displayName = 'CohortGroupView';
