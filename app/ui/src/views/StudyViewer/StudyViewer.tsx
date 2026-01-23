import { FC, useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './StudyViewer.module.css';
import { EditableTextField } from '../../components/EditableTextField/EditableTextField';
import { Tabs } from '../../components/ButtonsAndTabs/Tabs/Tabs';
import { StudyDataService } from './StudyDataService';

import { CohortsDataService } from '../LeftPanel/CohortsDataService';
import { SmartBreadcrumbs } from '../../components/SmartBreadcrumbs';
import { ViewNavBar } from '../../components/PhenExNavBar/ViewNavBar';
import navBarStyles from '../../components/PhenExNavBar/PhenExNavBar.module.css';
import { useFadeIn } from '../../hooks/useFadeIn';
import { getStudy } from '../../api/text_to_cohort/route';
import { 
  StudyViewerCohortDefinitionsLightWeight,
  StudyViewerCohortDefinitionsHandle 
} from './StudyViewerCohortDefinitions/StudyViewerCohortDefinitionsLightWeight';

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
  embeddedMode?: boolean;
  activeTabIndex?: number;
}

export const StudyViewer: FC<StudyViewerProps> = ({ data, embeddedMode = false, activeTabIndex }) => {
  const navigate = useNavigate();
  const [studyName, setStudyName] = useState('');
  const [isPublicStudy, setIsPublicStudy] = useState(false);
  const gridRef = useRef<any>(null);
  const [studyDataService] = useState(() => StudyDataService.getInstance());
  const [currentView, setCurrentView] = useState<StudyDefinitionViewType>(
    StudyDefinitionViewType.Cohort
  );
  
  // Navigation bar state
  const cohortViewRef = useRef<StudyViewerCohortDefinitionsHandle>(null);
  const [zoomPercentage, setZoomPercentage] = useState(58.3); // Default scale 1.0 maps to ~58.3%
  const [canNavigateLeft, setCanNavigateLeft] = useState(false);
  const [canNavigateRight, setCanNavigateRight] = useState(false);
  
  const fadeInStyle = useFadeIn();

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
              console.log('📚 Study not found in cache, fetching directly from API');
              // Fetch study directly from API
              try {
                studyData = await getStudy(data);
                console.log('📚 Successfully fetched study from API:', studyData);
              } catch (error) {
                console.error('📚 Failed to fetch study from API:', error);
                return;
              }
            }
            
            // Check if this is a public study
            const isPublic = publicStudies.some(s => s.id === data) || studyData.is_public;
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

  useEffect(() => {
    if (activeTabIndex !== undefined) {
      onTabChange(activeTabIndex);
    }
  }, [activeTabIndex]);

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

    return <SmartBreadcrumbs items={breadcrumbItems} onEditLastItem={handleEditLastItem} classNameSmartBreadcrumbsContainer={styles.breadcrumbsContainer} classNameBreadcrumbItem={styles.breadcrumbItem} classNameBreadcrumbLastItem={styles.breadcrumbLastItem} compact={false}/>;
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

  // Navigation bar handlers
  const handleZoomChange = useCallback((percentage: number) => {
    setZoomPercentage(percentage);
    // Update navigation state
    if (cohortViewRef.current) {
      setCanNavigateLeft(cohortViewRef.current.canNavigateLeft());
      setCanNavigateRight(cohortViewRef.current.canNavigateRight());
    }
  }, []);

  const handleNavigationArrowClicked = useCallback((direction: 'left' | 'right') => {
    cohortViewRef.current?.navigateCohort(direction);
    // Update navigation state after navigation
    setTimeout(() => {
      if (cohortViewRef.current) {
        setCanNavigateLeft(cohortViewRef.current.canNavigateLeft());
        setCanNavigateRight(cohortViewRef.current.canNavigateRight());
      }
    }, 0);
  }, []);

  const handleNavigationScroll = useCallback((percentage: number) => {
    cohortViewRef.current?.setZoomPercentage(percentage);
  }, []);

  const renderContent = () => {
    return (
      <StudyViewerCohortDefinitionsLightWeight 
        ref={cohortViewRef}
        studyDataService={studyDataService}
        onZoomChange={handleZoomChange}
      />
    );
  };

  return (
    <div className={styles.cohortTableContainer} style={fadeInStyle}>
      <div className={styles.bottomSection}>{renderContent()}</div>
      <div className={navBarStyles.topRight}>
        <ViewNavBar
          height={44}
          scrollPercentage={zoomPercentage}
          canScrollLeft={canNavigateLeft}
          canScrollRight={canNavigateRight}
          onViewNavigationArrowClicked={handleNavigationArrowClicked}
          onViewNavigationScroll={handleNavigationScroll}
        />
      </div>
    </div>
  );
};
