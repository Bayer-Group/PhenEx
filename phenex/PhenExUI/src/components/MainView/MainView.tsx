import React, { useState } from 'react';
import { HierarchicalLeftPanel } from '../LeftPanel/HierarchicalLeftPanel';
import { RightPanel } from '../RightPanel/RightPanel';
import { CohortTable } from '../RightPanel/Cohort/CohortTable';
import { ThreePanelView } from './ThreePanelView/ThreePanelView';
import { ChatPanel } from '../ChatPanel/ChatPanel';

import styles from './MainView.module.css';

export enum ViewType {
  FullPage = 'fullPage',
  Grouped = 'grouped',
  Empty = 'empty',
  Phenotypes = 'phenotypes',
  Databases = 'databases',
  CohortDefinition = 'sdef',
  CohortReport = 'sreport',
  ModalPhenotype = 'modalPhenotype',
  NewCohort = 'newCohort',
}

export interface ViewInfo {
  viewType: ViewType;
  data?: string;
}

export const MainView = () => {
  const [currentView, setCurrentView] = useState<ViewInfo>({
    viewType: ViewType.Empty,
    data: undefined,
  });

  const navigateTo = (viewInfo: ViewInfo) => {
    setCurrentView(viewInfo);
  };

  const renderView = () => {
    switch (currentView.viewType) {
      case ViewType.Empty:
        return null;
      case ViewType.CohortDefinition:
        return <CohortTable key={currentView.data} data={currentView.data} />;
      case ViewType.NewCohort:
        return <CohortTable key="new-cohort" data={undefined} />;
      default:
        return <FullPageTable {...currentView.data} />;
    }
  };

  /*
  The first split panel is the maincontent (file browser + cohort browser) and the chat window
  the second split panel is the maincontent (file browser + cohort browser)
  */
  const resizer_options = {
    css: {
      width: '1px',
      background: 'var(--background-color)',
    },
    hoverCss: {
      width: '3px',
      background: 'var(--accent-color)',
    },
    grabberSize: '1rem',
  };
  return (
    <div className={styles.mainView}>
      <ThreePanelView
        split="vertical"
        initalSizeRight={300}
        initalSizeLeft={300}
        minSizeLeft={100}
        minSizeRight={100}
      >
        <HierarchicalLeftPanel isVisible={true} onNavigate={navigateTo} />
        <RightPanel>{renderView()}</RightPanel>
        <ChatPanel
          onTextEnter={text => {
            console.log('Text entered:', text);
            // Handle the text input here
          }}
        ></ChatPanel>
      </ThreePanelView>
    </div>
  );
};
