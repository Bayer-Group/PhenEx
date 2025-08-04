import { FC, useState, useEffect, useRef } from 'react';
import styles from './AccordianTabbedInfoDisplayView.module.css';
import { TabsWithDropdown } from '../../../components/Tabs/TabsWithDropdown';
import { CohortDataService } from '../CohortDataService/CohortDataService';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';
import { ConstantsTable } from '../../SlideoverPanels/ConstantsPanel/ConstantsTable';
import { TypeSelectorEditor } from '../CohortTable/CellEditors/typeSelectorEditor/TypeSelectorEditor';
interface AccordianTabbedInfoDisplayViewProps {
  title: string;
  infoContent?: string;
}

import { CodelistsInfoDisplay } from '../../SlideoverPanels/CodelistsViewer/CodelistsInfoDisplay/CodelistsInfoDisplay';

enum InfoTabType {
  NewPhenotype = 'New Phenotype',
  Database = 'Database',
  Constants = 'Constants',
  Codelists = 'Codelists',
  Visibility = 'Visibility',
  Execute = 'Execute',
  Report = 'Report',
  Info = 'i',
}

export const AccordianTabbedInfoDisplayView: FC<AccordianTabbedInfoDisplayViewProps> = ({
  title,
  infoContent,
}) => {
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [isOpen, setIsOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<InfoTabType>(InfoTabType.Info);
  const customizableDropdownButtonRef = useRef(null);

  useEffect(() => {
    const updateAccordionState = () => {
      if (dataService.isNewCohortCreation()) {
        setCurrentTab(InfoTabType.Info);

        setIsOpen(true);
      }
    };

    updateAccordionState();
    dataService.addListener(updateAccordionState);

    return () => {
      dataService.removeListener(updateAccordionState);
    };
  }, [dataService]);

  const tabs = Object.values(InfoTabType).map(value => value.charAt(0) + value.slice(1));

  const showCodelists = () => {
    console.log('SH?OWING CODELISTS');
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('codelists');
  };

  const showReport = () => {
    console.log('SH?OWING CODELISTS');
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('report');
  };

  const showExecute = () => {
    console.log('SH?OWING Execute');
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('execute');
  };

  const showDatabase = () => {
    console.log("showing database");
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('database');
  }

  const showConstants = () => {
    console.log("showing constants");
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('constants');
  }

  const onTabChange = (index: number) => {
    const tabTypes = Object.values(InfoTabType);
    const currentTabIndex = tabTypes.indexOf(currentTab);
    console.log('ON TAB CHANGE', index);
    if (index == 0) {
      setIsOpen(false);
      return;
    }
    if (index == 1){
      showDatabase();
      setCurrentTab(tabTypes[index]);
      return;
    } if (index == 2){
      showConstants();
      setCurrentTab(tabTypes[index]);
      return;
    }
    if (index == 3) {
      showCodelists();
      setCurrentTab(tabTypes[index]);
      return;
    }
    if (index == 6) {
      showReport();
      setCurrentTab(tabTypes[index]);
      return;
    }
    if (index == 5) {
      // executeCohort();
      showExecute();
      return;
    }
    if (!isOpen) {
      setIsOpen(true);
      setCurrentTab(tabTypes[index]);
    } else if (currentTabIndex === index) {
      setIsOpen(false);
    } else {
      setCurrentTab(tabTypes[index]);
    }
  };

  const renderContent = () => {
    switch (currentTab) {
      case InfoTabType.Info:
        return <div className={styles.infoContent}>{infoContent}</div>;
      case InfoTabType.Constants:
        return <ConstantsTable />;
      case InfoTabType.Database:
        return <DatabaseFields />;
      case InfoTabType.Codelists:
        return <CodelistsInfoDisplay />;
      default:
        return <CodelistsInfoDisplay />;
    }
  };

  const handlePhenotypeSelection = type => {
    dataService.addPhenotype(type);
    setIsOpen(false);
  };

  const executeCohort = async () => {
    await dataService.executeCohort();
  };
  const clickedOnHeader = () => {
    console.log('CLICKED ON HEDAER', customizableDropdownButtonRef);
    customizableDropdownButtonRef.current?.closeDropdown();
  };

  const renderPhenotypeSelection = () => {
    return (
      <div className={styles.phenotypeSelection}>
        <div className={styles.phenotypeSelectionHeader} onClick={() => clickedOnHeader()}>
          New phenotype
          <span className={styles.phenotypeSelectionHeaderButton}>Close</span>
        </div>
        <TypeSelectorEditor onValueChange={handlePhenotypeSelection} />
      </div>
    );
  };
  return (
    <div className={`${styles.accordianContainer}`}>
      <div className={`${styles.header} ${styles.closed}`}>
        <div className={`${styles.tabsContainer} ${styles.closed}`}>
          <TabsWithDropdown
            width={'100%'}
            height={'100%'}
            tabs={tabs}
            dropdown_items={{ 0: renderPhenotypeSelection() }}
            onTabChange={onTabChange}
            active_tab_index={isOpen ? Object.values(InfoTabType).indexOf(currentTab) : -1}
            customizableDropdownButtonRef={customizableDropdownButtonRef}
          />
        </div>
      </div>
      <div className={styles.content}>
        {/* <div className={styles.contentArea}>{renderContent()}</div> */}
      </div>
    </div>
  );
};
