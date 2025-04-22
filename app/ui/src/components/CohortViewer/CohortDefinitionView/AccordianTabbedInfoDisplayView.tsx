import { FC, useState, useEffect } from 'react';
import styles from './AccordianTabbedInfoDisplayView.module.css';
import { Tabs } from '../../Tabs/Tabs';
import { CohortDataService } from '../CohortDataService/CohortDataService';
import { CohortDatabaseSettings } from '../CohortInfo/CohortDatabaseSettings/CohortDatabaseSettings';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';
import { ConstantsTable } from './ConstantsTable'
interface AccordianTabbedInfoDisplayViewProps {
  title: string;
  infoContent?: string;
}

import { CodelistsInfoDisplay } from './CodelistsInfoDisplay/CodelistsInfoDisplay';

enum InfoTabType {
  Info = 'i',
  Constants = 'Constants',
  Database = 'Database',
  Codelists = 'Codelists',
  Visibility = 'Visibility',

}

export const AccordianTabbedInfoDisplayView: FC<AccordianTabbedInfoDisplayViewProps> = ({
  title,
  infoContent,
}) => {
  const [dataService] = useState(() => CohortDataService.getInstance());
  const [isOpen, setIsOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<InfoTabType>(InfoTabType.Info);

  useEffect(() => {
    const updateAccordionState = () => {
      if (dataService.isNewCohortCreation()) {
        setCurrentTab(Object.values(InfoTabType)[0]);

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
    // TODO: Implement logic to show codelists
  };

  const onTabChange = (index: number) => {
    const tabTypes = Object.values(InfoTabType);
    const currentTabIndex = tabTypes.indexOf(currentTab);
    if (index == 3) {
      showCodelists();
      setCurrentTab(tabTypes[index]);
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
        return (
          <ConstantsTable/>
        );
      case InfoTabType.Database:
        return <CohortDatabaseSettings />;
      case InfoTabType.Codelists:
        return <CodelistsInfoDisplay />;
      default:
        return null;
    }
  };

  return (
    <div className={`${styles.accordianContainer} ${isOpen ? styles.opened : ''}`}>
      <div className={`${styles.header} ${!isOpen ? styles.closed : ''}`}>
        <h2>{title}</h2>
        <button
          className={`${styles.toggleButton} ${!isOpen ? styles.closed : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close panel' : 'Open panel'}
        >
          {'>>'}
        </button>
        <div className={`${styles.tabsContainer} ${!isOpen ? styles.closed : ''}`}>
          <Tabs
            width={200}
            height={25}
            tabs={tabs}
            onTabChange={onTabChange}
            active_tab_index={isOpen ? Object.values(InfoTabType).indexOf(currentTab) : -1}
          />
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.contentArea}>{renderContent()}</div>
      </div>
    </div>
  );
};
