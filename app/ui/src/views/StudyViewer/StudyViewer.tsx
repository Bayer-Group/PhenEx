import { FC, useState, useRef, useEffect } from 'react';
import styles from './StudyViewer.module.css';
import { EditableTextField } from '../../components/EditableTextField/EditableTextField';
import { Tabs } from '../../components/ButtonsAndTabs/Tabs/Tabs';
import { CustomizableDropdownButton } from '@/components/ButtonsAndTabs/ButtonsBar/CustomizableDropdownButton';
import { StudyDataService } from './StudyDataService';

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
  const [studyName, setStudyName] = useState(data ?? '');
  const gridRef = useRef<any>(null);
  const [studyDataService] = useState(() => StudyDataService.getInstance());
  const [currentView, setCurrentView] = useState<StudyDefinitionViewType>(
    StudyDefinitionViewType.Cohort
  );

  useEffect(() => {
    // Update cohort data when a new cohort is selected
    const loadData = async () => {
      if (data !== undefined) {
        await studyDataService.loadStudyData(data);
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



  // FOR ADD NEW PHENOTYPE DROPDOWN
  const renderAddNewPhenotypeButton = () => {
    return (
        <CustomizableDropdownButton
          key={"new cohort"}
          label={"Add a new cohort"}
          content={''}
          buttonClassName={styles.addPhenotypeButtonLabel}
          outline={true}
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

  const renderTable = () => {
    return (
      <div />
    );
  };

  return (
    <div className={styles.cohortTableContainer}>
      <div className={styles.topSection}>
        {renderTitle()}
        {renderSectionTabs()}
      </div>
      <div className={styles.bottomSection}>{renderTable()}</div>
    </div>
  );
};
