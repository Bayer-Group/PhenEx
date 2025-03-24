import { FC, useState } from 'react';
import styles from './AccordianTabbedInfoDisplayView.module.css';
import { Tabs } from '../../Tabs/Tabs';

interface AccordianTabbedInfoDisplayViewProps {
  title: string;
  infoContent?: string;
}

enum InfoTabType {
  Info = 'i',
  Variables = 'Constants',
  Database = 'Database',

}

export const AccordianTabbedInfoDisplayView: FC<AccordianTabbedInfoDisplayViewProps> = ({
  title,
  infoContent,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [currentTab, setCurrentTab] = useState<InfoTabType>(InfoTabType.Info);

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
      case InfoTabType.Variables:
        return (
          <div className={styles.variablesContent}>
            <div className={styles.variableGroup}>
              <label>Baseline Period (days):</label>
              <input type="number" defaultValue={365} />
            </div>
            <div className={styles.variableGroup}>
              <label>Follow-up Period (days):</label>
              <input type="number" defaultValue={730} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`${styles.accordianContainer} ${isOpen ? styles.opened : ''}`}>
      <div className={styles.header}>
        <h2>{title}</h2>
        <button
          className={`${styles.toggleButton} ${!isOpen ? styles.closed : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close panel' : 'Open panel'}
        >
          {'>>'}
        </button>
        <div className={styles.tabsContainer}>
            <Tabs
              width={200}
              height={30}
              tabs={tabs}
              onTabChange={onTabChange}
              active_tab_index={Object.values(InfoTabType).indexOf(currentTab)}
            />
          </div>
      </div>
      {isOpen && (
        <div className={styles.content}>
          <div className={styles.contentArea}>{renderContent()}</div>
        </div>
      )}
    </div>
  );
};
