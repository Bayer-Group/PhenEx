import React, { useState, useEffect } from 'react';
import styles from './SlideoverPanel.module.css';
import { TwoPanelCohortViewerService } from '../../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';

interface SlideoverPanelProps {
  title: string;
  info: string | React.ReactNode | undefined;
  children: React.ReactNode;
  headerControls?: React.ReactNode;
  classNameHeader?: string;
  classNameContainer?: string;
  showTitle?: boolean;
}

const SLIDEOVER_PANEL_INFO_STATE_KEY = 'slideoverPanelInfoOpen';

const getInfoBoxState = (): boolean => {
  try {
    const stored = localStorage.getItem(SLIDEOVER_PANEL_INFO_STATE_KEY);
    return stored !== null ? JSON.parse(stored) : true; // Default to open
  } catch {
    return true; // Default to open if parsing fails
  }
};

const setInfoBoxState = (isOpen: boolean): void => {
  try {
    localStorage.setItem(SLIDEOVER_PANEL_INFO_STATE_KEY, JSON.stringify(isOpen));
  } catch {
    // Handle localStorage errors silently
  }
};

export const SlideoverPanel: React.FC<SlideoverPanelProps> = ({
  title,
  info = '',
  children,
  headerControls,
  classNameHeader = '',
  classNameContainer = '',
  showTitle = true,
}) => {
  const [isOpen, setIsOpen] = useState(getInfoBoxState);

  useEffect(() => {
    // Listen for storage changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SLIDEOVER_PANEL_INFO_STATE_KEY && e.newValue !== null) {
        try {
          setIsOpen(JSON.parse(e.newValue));
        } catch {
          // Handle parsing errors silently
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleInfobox = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    const newState = !isOpen;
    setIsOpen(newState);
    setInfoBoxState(newState);
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  const renderHeader = () => {
    return <div className={styles.title}>{title}</div>;
  };

  const clickOnHeader = () => {
    const cohortViewer = TwoPanelCohortViewerService.getInstance();
    cohortViewer.hideExtraContent();
  };

  return (
    <div className={`${styles.container} ${classNameContainer}`} onClick={onClick}>
      <div className={`${styles.header} ${classNameHeader}`} onClick={clickOnHeader}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            {showTitle && renderHeader()}
            <div
              className={`${styles.infobox} ${isOpen ? styles.open : styles.closed}`}
              onClick={toggleInfobox}
            >
              {info}
            </div>
          </div>
          {headerControls != null && (
            <div className={styles.headerControls} onClick={e => e.stopPropagation()}>
              {headerControls}
            </div>
          )}
        </div>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};
