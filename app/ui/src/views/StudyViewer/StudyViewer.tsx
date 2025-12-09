import { FC, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './StudyViewer.module.css';
import { EditableTextField } from '../../components/EditableTextField/EditableTextField';
import { Tabs } from '../../components/ButtonsAndTabs/Tabs/Tabs';
import { StudyDataService } from './StudyDataService';
import { StudyViewerCohortDefinitions } from './StudyViewerCohortDefinitions/StudyViewerCohortDefinitions';
import { MainViewService, ViewType } from '../MainView/MainView';
import { CohortsDataService } from '../LeftPanel/CohortsDataService';
import { SmartBreadcrumbs } from '../../components/SmartBreadcrumbs';
enum StudyDefinitionViewType {
  Cohort = 'cohort',
  Baseline = 'baseline',
  Outcomes = 'outcomes',
}

const sectionDisplayNames = {
  [StudyDefinitionViewType.Cohort]: 'Cohort definition',
  [StudyDefinitionViewType.Baseline]: 'Baseline characteristics',
  [StudyDefinitionViewType.Outcomes]: 'Outcomes',
};

interface StudyViewerProps {
  data?: string;
}

export const StudyViewer: FC<StudyViewerProps> = ({ data }) => {
  const navigate = useNavigate();
  const [studyName, setStudyName] = useState('');
  const [isPublicStudy, setIsPublicStudy] = useState(false);
  const gridRef = useRef<any>(null);
  const [studyDataService] = useState(() => StudyDataService.getInstance());
  const [currentView, setCurrentView] = useState<StudyDefinitionViewType>(
    StudyDefinitionViewType.Cohort
  );

  useEffect(() => {
    // Update cohort data when a new cohort is selected
    const loadData = async () => {
      if (data !== undefined) {
        
        // If data is a string (study ID), fetch the full study data
        if (typeof data === 'string') {
          try {
            const cohortsDataService = CohortsDataService.getInstance();
            
            // Try to find the study in the cached studies first
            const userStudies = await cohortsDataService.getUserStudies();
            const publicStudies = await cohortsDataService.getPublicStudies();
            const allStudies = [...userStudies, ...publicStudies];
            
            let studyData = allStudies.find(s => s.id === data);
            
            if (!studyData) {
              console.error('📚 Study not found in cache, attempting direct fetch');
              // TODO: Add API call to fetch single study by ID if needed
              return;
            }
            
            // Check if this is a public study
            const isPublic = publicStudies.some(s => s.id === data);
            setIsPublicStudy(isPublic);
            
            // Fetch cohorts for this study
            const cohorts = await cohortsDataService.getCohortsForStudy(data);
            
            // Add cohorts to study data
            studyData = { ...studyData, cohorts };
            
            studyDataService.loadStudyData(studyData);
          } catch (error) {
            console.error('Error loading study:', error);
          }
        } else {
          // Data is already a full study object
          studyDataService.loadStudyData(data);
        }
      } else {
        studyDataService.createNewStudy();
      }
      setStudyName(studyDataService.study_name);
    };
    loadData();
  }, [data]);

  useEffect(() => {
    // Update cohort name when data service changes
    const updateStudyName = () => {
      if (studyDataService.study_data?.name) {
        setStudyName(studyDataService._study_name);
      }
    };

    updateStudyName();
    studyDataService.addStudyDataServiceListener(updateStudyName);

    return () => {
      studyDataService.removeStudyDataServiceListener(updateStudyName);
    };
  }, [studyDataService]);

  const tabs = Object.values(StudyDefinitionViewType).map(value => {
    return sectionDisplayNames[value];
  });

  const onTabChange = (index: number) => {
    const viewTypes = Object.values(StudyDefinitionViewType);
    const newView = viewTypes[index];

    // // First update the data filter
    // switch (newView) {
    //   case StudyDefinitionViewType.Cohort:
    //     studyDataService.filterType(['entry', 'inclusion', 'exclusion']);
    //     break;
    //   case StudyDefinitionViewType.Baseline:
    //     studyDataService.filterType('baseline');
    //     break;
    //   case StudyDefinitionViewType.Outcomes:
    //     studyDataService.filterType('outcome');
    //     break;
    // }

    // // Then update the view and refresh grid
    setCurrentView(newView);
    // refreshGrid();
  };

  const determineTabIndex = (): number => {
    return Object.values(StudyDefinitionViewType).indexOf(currentView);
  };

  const renderTitle = () => {
    return (
      <div className={styles.studyNameContainer}>
        <EditableTextField
          value={studyName}
          placeholder="Name your cohort..."
          classNameInput={styles.studyNameInput}
          onChange={newValue => {
            setStudyName(newValue);
            studyDataService._study_name = newValue;
          }}
          onSaveChanges={async () => {
            await studyDataService.saveChangesToStudy();
          }}
        />
      </div>
    );
  };

  const navigateToMyStudies = () => {
    // Navigate back to studies page
    window.location.href = '/studies';
  };

  const renderBreadcrumbs = () => {
    const breadcrumbItems = [
      {
        displayName: isPublicStudy ? 'Public Studies' : 'My Studies',
        onClick: navigateToMyStudies,
      },
      {
        displayName: studyName || 'Unnamed Study',
        onClick: () => {},
      },
    ];

    const handleEditLastItem = async (newValue: string) => {
      setStudyName(newValue);
      studyDataService._study_name = newValue;
      await studyDataService.saveChangesToStudy();
    };

    return <SmartBreadcrumbs items={breadcrumbItems} onEditLastItem={handleEditLastItem} classNameSmartBreadcrumbsContainer={styles.breadcrumbsContainer} classNameBreadcrumbItem={styles.breadcrumbItem} classNameBreadcrumbLastItem={styles.breadcrumbLastItem}/>;
  };

  const clickedOnAddNewCohort = async () => {
    // Get the study ID from the data prop or the service
    let studyId = studyDataService.study_data?.id;
    if (!studyId && typeof data === 'string') {
      studyId = data;
    } else if (!studyId && data && typeof data === 'object') {
      studyId = (data as any).id;
    }
    
    if (!studyId) {
      console.error('No study ID found');
      return;
    }

    // Use centralized helper to ensure consistent behavior
    const { createAndNavigateToNewCohort } = await import('../LeftPanel/studyNavigationHelpers');
    await createAndNavigateToNewCohort(studyId, navigate);
  };


  const renderSectionTabs = () => {
    return (
      <div className={styles.sectionTabsContainer}>
        <Tabs
          width={400}
          height={25}
          tabs={tabs}
          onTabChange={onTabChange}
          active_tab_index={determineTabIndex()}
          classNameTabsContainer={styles.classNameTabsContainer}
        />
      </div>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case StudyDefinitionViewType.Cohort:
        return <StudyViewerCohortDefinitions studyDataService={studyDataService} />;
      case StudyDefinitionViewType.Baseline:
      case StudyDefinitionViewType.Outcomes:
        return <StudyViewerCohortDefinitions studyDataService={studyDataService} />;
      default:
        return <div />;
    }
  };

  return (
    <div className={styles.cohortTableContainer}>
      <div className={styles.topSection}>
        {renderBreadcrumbs()}
        {renderSectionTabs()}
      </div>
      <button 
        className={styles.newCohortButton}
        onClick={clickedOnAddNewCohort}
      >
        + New Cohort
      </button>
      <div className={styles.bottomSection}>{renderContent()}</div>
    </div>
  );
};
