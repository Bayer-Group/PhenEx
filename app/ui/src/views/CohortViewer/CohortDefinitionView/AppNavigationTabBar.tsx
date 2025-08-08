import { FC, useState, useEffect, useRef } from 'react';
import styles from './AppNavigationTabBar.module.css';
import { TabsWithDropdown } from '../../../components/Tabs/TabsWithDropdown';
import { CohortDataService } from '../CohortDataService/CohortDataService';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';
import { ConstantsTable } from '../../SlideoverPanels/ConstantsPanel/ConstantsTable';
import { TypeSelectorEditor } from '../CohortTable/CellEditors/typeSelectorEditor/TypeSelectorEditor';
interface AppNavigationTabBarProps {
  title: string;
  infoContent?: string;
}

import { CodelistsInfoDisplay } from '../../SlideoverPanels/CodelistsViewer/CodelistsInfoDisplay/CodelistsInfoDisplay';

enum InfoTabType {
  NewPhenotype = 'Add Phenotype',
  Database = 'Database',
  Constants = 'Constants',
  Codelists = 'Codelists',
  Visibility = 'Visibility',
  Execute = 'Execute',
  Report = 'Report',
  Info = 'i',
}

export const AppNavigationTabBar: FC<AppNavigationTabBarProps> = ({
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
    console.log('showing database');
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('database');
  };

  const showConstants = () => {
    console.log('showing constants');
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('constants');
  };

  const onTabChange = (index: number) => {
    const tabTypes = Object.values(InfoTabType);
    const currentTabIndex = tabTypes.indexOf(currentTab);
    console.log('ON TAB CHANGE', index, currentTabIndex);
    if (index == 0) {
      setIsOpen(false);
    }
    if (index == 1) {
      showDatabase();
      setCurrentTab(tabTypes[index]);
      console.log("clicked database", isOpen)
    }
    if (index == 2) {
      showConstants();
      setCurrentTab(tabTypes[index]);
    }
    if (index == 3) {
      showCodelists();
      setCurrentTab(tabTypes[index]);
    }
    if (index == 6) {
      showReport();
      setCurrentTab(tabTypes[index]);
    }
    if (index == 5) {
      // executeCohort();
      showExecute();
    }
    console.log("clicked",index, isOpen)
    if (!isOpen) {
      setIsOpen(true);
      setCurrentTab(tabTypes[index]);
    } else{
      if (index === currentTabIndex){
        setIsOpen(false);
        const cohortViewer = TwoPanelCohortViewerService.getInstance();
        cohortViewer.hideExtraContent();
        setCurrentTab(tabTypes[index]);
      }
    }
  };


  const executeCohort = async () => {
    await dataService.executeCohort();
  };
  const clickedOnHeader = () => {
    customizableDropdownButtonRef.current?.closeDropdown();
  };

  const handleAddNewPhenotypeDropdownSelection = type => {
    dataService.addPhenotype(type);
    setIsOpen(false);
  };

  const renderAddNewPhenotypeDropdown = () => {
    return (
      <div className={styles.addNewPhenotypeDropdown}>
        <div className={styles.addNewPhenotypeDropdownHeader} onClick={() => clickedOnHeader()}>
          Add a new phenotype
          <span className={styles.addNewPhenotypeDropdownHeaderButton}>Close</span>
        </div>
        <TypeSelectorEditor onValueChange={handleAddNewPhenotypeDropdownSelection} />
      </div>
    );
  };
  return (
    <div className={`${styles.accordianContainer} ${styles.closed}`}>
      <div className={`${styles.tabsContainer} ${styles.closed}`}>
        <TabsWithDropdown
          width={'100%'}
          height={'100%'}
          tabs={tabs}
          dropdown_items={{ 0: renderAddNewPhenotypeDropdown() }}
          onTabChange={onTabChange}
          active_tab_index={isOpen ? Object.values(InfoTabType).indexOf(currentTab) : -1}
          customizableDropdownButtonRef={customizableDropdownButtonRef}
        />
      </div>
    </div>
  );
};
