import { FC, useState } from 'react';
import styles from './CodelistInfoAccordianTabbedInfoDisplay.module.css';
import { Tabs } from '../../../../components/ButtonsAndTabs/Tabs/Tabs';
import { CodelistColumnMapping } from '../CodelistsInfoDisplay/CodelistColumnMapping';
import { CodelistFileContent } from '../CodelistsInfoDisplay/CodelistFileContent';

interface CodelistInfoAccordianTabbedInfoDisplayProps {
  title: string;
  infoContent?: string;
}

enum InfoTabType {
  Info = 'Info',
  Mapping = 'Mapping',
  Edit = 'Edit',
  Visibility = 'Visibility',
}

export const CodelistInfoAccordianTabbedInfoDisplay: FC<
  CodelistInfoAccordianTabbedInfoDisplayProps
> = ({ title, infoContent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<InfoTabType>(InfoTabType.Info);

  const tabs = Object.values(InfoTabType).map(value => value.charAt(0) + value.slice(1));

  const onTabChange = (index: number) => {
    const tabTypes = Object.values(InfoTabType);
    const currentTabIndex = tabTypes.indexOf(currentTab);
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
        return <CodelistFileContent />;
      case InfoTabType.Mapping:
        return <CodelistColumnMapping />;
      case InfoTabType.Edit:
        return <div className={styles.editContent}></div>;
      case InfoTabType.Visibility:
        return <div className={styles.visibilityContent}></div>;
      default:
        return null;
    }
  };

  return (
    <div className={`${styles.accordianContainer} ${isOpen ? styles.opened : ''}`}>
      <div className={`${styles.header} ${!isOpen ? styles.closed : ''}`}>
        <button
          className={`${styles.toggleButton} ${!isOpen ? styles.closed : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close panel' : 'Open panel'}
        >
          {'×'}
        </button>
      </div>
      <div className={`${styles.tabsContainer} ${!isOpen ? styles.closed : ''}`}>
        <Tabs
          width={200}
          height={25}
          tabs={tabs}
          onTabChange={onTabChange}
          active_tab_index={isOpen ? Object.values(InfoTabType).indexOf(currentTab) : -1}
        />
      </div>

      <div className={styles.content}>
        <div className={styles.contentArea}>{renderContent()}</div>
      </div>
    </div>
  );
};
