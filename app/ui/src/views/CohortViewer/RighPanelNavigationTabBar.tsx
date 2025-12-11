import { FC, useState, useEffect } from 'react';
import styles from './RighPanelNavigationTabBar.module.css';
import { TabsWithDropdown } from '../../components/ButtonsAndTabs/Tabs/TabsWithDropdown';

import { CohortDataService } from './CohortDataService/CohortDataService';
import { TwoPanelCohortViewerService } from './TwoPanelCohortViewer/TwoPanelCohortViewer';

interface RighPanelNavigationTabBarProps {
  title: string;
  infoContent?: string;
  onSectionTabChange?: (index: number) => void;
}

enum InfoTabType {
  Info = 'Info',
  Database = 'Database',
  Constants = 'Constants',
  Codelists = 'Codelists',
  Visibility = 'Visibility',
  Execute = 'Execute',
  Report = 'Report',
}

export const RighPanelNavigationTabBar: FC<RighPanelNavigationTabBarProps> = () => {
  // Note: props title, infoContent, and onSectionTabChange are currently unused
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [isOpen, setIsOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<InfoTabType>(InfoTabType.Info);

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
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('codelists', null);
  };

  const showReport = () => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('report', null);
  };

  const showExecute = () => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('execute', null);
  };

  const showDatabase = () => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('database', null);
  };

  const showConstants = () => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('constants', null);
  };

  const showVisibility = () => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('visibility', null);
  };

  const showInfo = () => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('info', null);
  };

  const onTabChange = (index: number) => {
    const tabTypes = Object.values(InfoTabType);
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

  return (
    <div className={`${styles.tabsContainer} ${styles.closed}`}>
      <TabsWithDropdown
        width={'100%'}
        height={'100%'}
        tabs={tabs}
        onTabChange={onTabChange}
        active_tab_index={isOpen ? Object.values(InfoTabType).indexOf(currentTab) : -1}
      />
    </div>
  );
};
