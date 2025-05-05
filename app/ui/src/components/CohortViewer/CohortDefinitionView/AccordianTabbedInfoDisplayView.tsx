import { FC, useState, useEffect } from 'react';
import styles from './AccordianTabbedInfoDisplayView.module.css';
import { TabsWithDropdown } from '../../Tabs/TabsWithDropdown';
import { CohortDataService } from '../CohortDataService/CohortDataService';
import { CohortDatabaseSettings } from '../CohortInfo/CohortDatabaseSettings/CohortDatabaseSettings';
import { TwoPanelCohortViewerService } from '../TwoPanelCohortViewer/TwoPanelCohortViewer';
import { ConstantsTable } from './ConstantsTable';
import { TypeSelectorEditor } from '../CohortTable/CellEditors/typeSelectorEditor/TypeSelectorEditor';
interface AccordianTabbedInfoDisplayViewProps {
  title: string;
  infoContent?: string;
}

import { CodelistsInfoDisplay } from '../../CodelistsViewer/CodelistsInfoDisplay/CodelistsInfoDisplay';

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
  };

  const showReport = () => {
    console.log('SH?OWING CODELISTS');
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.displayExtraContent('report');
  };

  const onTabChange = (index: number) => {
    const tabTypes = Object.values(InfoTabType);
    const currentTabIndex = tabTypes.indexOf(currentTab);
    console.log('ON TAB CHANGE', index);
    if (index == 0) {
      setIsOpen(false);
      return;
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
      executeCohort();
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
        return <ConstantsTable />;
      case InfoTabType.Database:
        return <CohortDatabaseSettings />;
      case InfoTabType.Codelists:
        return <CodelistsInfoDisplay />;
      default:
        return null;
    }
  };

  const handlePhenotypeSelection = type => {
    dataService.addPhenotype(type);
    setIsOpen(false);
  };

  const executeCohort = async () => {
    await dataService.executeCohort();
  };

  const renderPhenotypeSelection = () => {
    return (
      <div className={styles.phenotypeSelection}>
        <div className={styles.phenotypeSelectionHeader}>New phenotype</div>
        <TypeSelectorEditor onValueChange={handlePhenotypeSelection} />
      </div>
    );
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
          {'>'}
        </button>
        <div className={`${styles.tabsContainer} ${!isOpen ? styles.closed : ''}`}>
          <TabsWithDropdown
            width={'100%'}
            height={'100%'}
            tabs={tabs}
            dropdown_items={{ 0: renderPhenotypeSelection() }}
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
