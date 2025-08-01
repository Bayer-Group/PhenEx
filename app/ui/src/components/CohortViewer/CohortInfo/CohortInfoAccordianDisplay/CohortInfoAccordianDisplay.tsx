import { FC, useState } from 'react';
import styles from './CohortInfoAccordianDisplay.module.css';
import { Tabs } from '../../../Tabs/Tabs';
import deleteIcon from '../../../../assets/icons/delete.svg';
import { CohortDataService } from '../../CohortDataService/CohortDataService';

interface CohortInfoAccordianDisplayViewProps {
  title: string;
  infoContent?: string;
}

enum InfoTabType {
  Info = 'i',
  Variables = 'Database',
  Settings = 'Settings',
}

export const CohortInfoAccordianDisplayView: FC<CohortInfoAccordianDisplayViewProps> = ({
  title,
  infoContent,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [currentTab, setCurrentTab] = useState<InfoTabType>(InfoTabType.Info);
  const dataService = CohortDataService.getInstance();

  const tabs = Object.values(InfoTabType).map(value => value.charAt(0) + value.slice(1));

  const onTabChange = (index: number) => {
    if (!isOpen) {
      setIsOpen(true);
    }
    const tabTypes = Object.values(InfoTabType);
    setCurrentTab(tabTypes[index]);
  };

  const renderContent = () => {
    switch (currentTab) {
      case InfoTabType.Info:
        return <div className={styles.infoContent}>{infoContent}</div>;

      case InfoTabType.Settings:
        return (
          <div>
            <button
              className={styles.editButton}
              onClick={() => {
                dataService.deleteCohort();
              }}
            >
              <img src={deleteIcon} className={styles.editIcon} alt="Delete" />
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`${styles.accordianContainer} ${isOpen ? styles.opened : ''}`}>
      <div className={styles.header}>
        <div className={styles.tabsContainer}>
          <Tabs
            width={200}
            height={25}
            tabs={tabs}
            onTabChange={onTabChange}
            active_tab_index={isOpen ? Object.values(InfoTabType).indexOf(currentTab) : -1}
          />
        </div>
        <button
          className={`${styles.toggleButton} ${!isOpen ? styles.closed : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close panel' : 'Open panel'}
        >
          {'>'}
        </button>
      </div>
      {isOpen && (
        <div className={styles.content}>
          <div className={styles.contentArea}>{renderContent()}</div>
        </div>
      )}
    </div>
  );
};
