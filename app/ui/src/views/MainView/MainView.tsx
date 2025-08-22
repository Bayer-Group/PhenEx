import { useState, useEffect } from 'react';
import { HierarchicalLeftPanel } from '../LeftPanel/HierarchicalLeftPanel';
import { RightPanel } from './RightPanel';
import { CohortViewer } from '../CohortViewer/CohortViewer';
import { ThreePanelView } from './ThreePanelView/ThreePanelView';
import { ChatPanel } from '../ChatPanel/ChatPanel';
import { SplashPage } from './SplashPage/SplashPage';
import { TwoPanelCohortViewer } from '../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';

import styles from './MainView.module.css';

export enum ViewType {
  FullPage = 'fullPage',
  Grouped = 'grouped',
  Empty = 'empty',
  Phenotypes = 'phenotypes',
  Databases = 'databases',
  CohortDefinition = 'sdef',
  PublicCohortDefinition = 'psdef',
  CohortReport = 'sreport',
  ModalPhenotype = 'modalPhenotype',
  NewCohort = 'newCohort',
}

export interface ViewInfo {
  viewType: ViewType;
  data?: any; // TODO: Make this more specific with a union type of possible data types
}

export class MainViewService {
  private static instance: MainViewService | null = null;
  private listeners: Array<(viewInfo: ViewInfo) => void> = [];

  private constructor() {}

  public static getInstance(): MainViewService {
    if (!MainViewService.instance) {
      MainViewService.instance = new MainViewService();
    }
    return MainViewService.instance;
  }

  public navigateTo = (viewInfo: ViewInfo) => {
    console.log("NAVIGATING ?TO", viewInfo)
    this.notifyListeners(viewInfo);
  };

  private notifyListeners(viewInfo: ViewInfo) {
    this.listeners.forEach(listener => listener(viewInfo));
  }

  public addListener(listener: (viewInfo: ViewInfo) => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: (viewInfo: ViewInfo) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
}

export const MainView = () => {
  const [currentView, setCurrentView] = useState<ViewInfo>({
    viewType: ViewType.Empty,
    data: undefined,
  });

  useEffect(() => {
    const service = MainViewService.getInstance();
    const updateView = (viewInfo: ViewInfo) => {
      setCurrentView(viewInfo);
    };

    service.addListener(updateView);
    return () => service.removeListener(updateView);
  }, []);

  const renderView = () => {
    console.log("RENDERING VIEW", currentView.viewType);
    switch (currentView.viewType) {
      case ViewType.Empty:
        return <SplashPage />;
      case ViewType.CohortDefinition:
        return <TwoPanelCohortViewer data={currentView.data} />;
      case ViewType.PublicCohortDefinition:
        return <TwoPanelCohortViewer data={currentView.data} />;
      case ViewType.NewCohort:
        console.log("THIS PLACE")
        return <CohortViewer data={undefined} />;
      default:
        console.log("THIS")
        return <SplashPage />;
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
        minSizeLeft={300}
        minSizeRight={300}
      >
        <HierarchicalLeftPanel isVisible={true} />
        <RightPanel>{renderView()}</RightPanel>
        <ChatPanel
          onTextEnter={text => {
            // Handle the text input here
          }}
        ></ChatPanel>
      </ThreePanelView>
    </div>
  );
};
