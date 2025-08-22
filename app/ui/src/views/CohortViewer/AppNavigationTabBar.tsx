import { FC, useState, useEffect, useRef } from 'react';
import styles from './AppNavigationTabBar.module.css';
import { TabsWithDropdown } from '../../components/ButtonsAndTabs/Tabs/TabsWithDropdown';
import { PopoverHeader } from '../../components/PopoverHeader/PopoverHeader';

import { CohortDataService } from './CohortDataService/CohortDataService';
import { TwoPanelCohortViewerService } from './TwoPanelCohortViewer/TwoPanelCohortViewer';
import { ConstantsTable } from '../SlideoverPanels/ConstantsPanel/ConstantsTable';
import { TypeSelectorEditor } from './CohortTable/CellEditors/typeSelectorEditor/TypeSelectorEditor';
interface AppNavigationTabBarProps {
  title: string;
  infoContent?: string;
  onSectionTabChange?: (index: number) => void;
}

import { CodelistsInfoDisplay } from '../SlideoverPanels/CodelistsViewer/CodelistsInfoDisplay/CodelistsInfoDisplay';

enum InfoTabType {
  Info = 'Info',
  Database = 'Database',
  Constants = 'Constants',
  Codelists = 'Codelists',
  Visibility = 'Visibility',
  Execute = 'Execute',
  Report = 'Report',
  NewPhenotype = 'Add Phenotype',
}

export const AppNavigationTabBar: FC<AppNavigationTabBarProps> = ({ title, infoContent, onSectionTabChange }) => {
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

  const showVisibility = () => {
    console.log('showing constants');
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('visibility');
  };

  const showInfo = () => {
    console.log('showing constants');
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('info');
  };

  const onTabChange = (index: number) => {
    const tabTypes = Object.values(InfoTabType);
    const currentTabIndex = tabTypes.indexOf(currentTab);
    console.log('ON TAB CHANGE', index, currentTabIndex);
    if (index == 0) {
      setIsOpen(false);
    }

    const actions = [
      showInfo,
      showDatabase,
      showConstants,
      showCodelists,
      showVisibility,
      showExecute,
      showReport,
    ];

    const action = actions[index];
    action();

    console.log('clicked', index, isOpen);
    if (!isOpen) {
      setIsOpen(true);
      setCurrentTab(tabTypes[index]);
    } else {
      // if (index === currentTabIndex) {
      //   setIsOpen(false);
      //   const cohortViewer = TwoPanelCohortViewerService.getInstance();
      //   cohortViewer.hideExtraContent();
      //   setCurrentTab(tabTypes[index]);
      // }
    }
  };

  const executeCohort = async () => {
    await dataService.executeCohort();
  };
  const clickedOnHeader = () => {
    customizableDropdownButtonRef.current?.closeDropdown();
  };

  const handleAddNewPhenotypeDropdownSelection = (type: string) => {
    dataService.addPhenotype(type);
    // Switch to the appropriate section tab based on phenotype type
    if (onSectionTabChange) {
      if (type === 'baseline') {
        onSectionTabChange(1); // Baseline characteristics tab
      } else if (type === 'outcome') {
        onSectionTabChange(2); // Outcomes tab
      } else if (['entry', 'inclusion', 'exclusion'].includes(type)) {
        onSectionTabChange(0); // Cohort definition tab
      }
    }

    setIsOpen(false);
  };

  const renderAddNewPhenotypeDropdown = () => {
    return (
      <div className={styles.addNewPhenotypeDropdown}>
        <PopoverHeader
          onClick={clickedOnHeader}
          title={'Add a new phenotype'}
          className={styles.popoverheader}
        />
        <TypeSelectorEditor onValueChange={handleAddNewPhenotypeDropdownSelection} />
      </div>
    );
  };
  return (
    <div className={`${styles.tabsContainer} ${styles.closed}`}>
        <TabsWithDropdown
          width={'100%'}
          height={'100%'}
          tabs={tabs}
          dropdown_items={{ 7: renderAddNewPhenotypeDropdown() }}
          onTabChange={onTabChange}
          active_tab_index={isOpen ? Object.values(InfoTabType).indexOf(currentTab) : -1}
          customizableDropdownButtonRef={customizableDropdownButtonRef}
          outline_tab_index={7}
        />
    </div>
  );
};
