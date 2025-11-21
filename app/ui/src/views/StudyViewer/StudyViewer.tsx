import { FC, useState, useRef, useEffect } from 'react';
import styles from './StudyViewer.module.css';
import { EditableTextField } from '../../components/EditableTextField/EditableTextField';
import { Tabs } from '../../components/ButtonsAndTabs/Tabs/Tabs';
import { Button } from '@/components/ButtonsAndTabs/Button/Button';
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
  const [studyName, setStudyName] = useState('');
  const gridRef = useRef<any>(null);
  const [studyDataService] = useState(() => StudyDataService.getInstance());
  const [currentView, setCurrentView] = useState<StudyDefinitionViewType>(
    StudyDefinitionViewType.Cohort
  );

  useEffect(() => {
    // Update cohort data when a new cohort is selected
    const loadData = async () => {
      if (data !== undefined) {
        studyDataService.loadStudyData(data);
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
    // Empty function - placeholder for future navigation to studies list
  };

  const renderBreadcrumbs = () => {
    const breadcrumbItems = [
      {
        displayName: 'My Studies',
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
    // Get the study ID from the data prop
    const studyId = studyDataService.study_data?.id;
    
    if (!studyId) {
      console.error('No study ID found');
      return;
    }

    // Create a new cohort for this study
    const cohortsDataService = CohortsDataService.getInstance();
    const newCohortData = await cohortsDataService.createNewCohort(studyDataService.study_data);
    
    if (newCohortData) {
      // Navigate to the NewCohort view which will show the wizard
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo({ 
        viewType: ViewType.NewCohort, 
        data: newCohortData 
      });
    }
  };


  // FOR ADD NEW PHENOTYPE DROPDOWN
  const renderAddNewPhenotypeButton = () => {
    return (
        <Button
          key={"new cohort"}
          title="+ New Cohort"
          onClick={clickedOnAddNewCohort}
        />
    );
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
        <div className={styles.addPhenotypeButton}>
          {renderAddNewPhenotypeButton()}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (currentView) {
      case StudyDefinitionViewType.Cohort:
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
      <div className={styles.bottomSection}>{renderContent()}</div>
    </div>
  );
};
