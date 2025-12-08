import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { HierarchicalLeftPanel } from '../LeftPanel/HierarchicalLeftPanel';
import { RightPanel } from './RightPanel';
import { CohortViewer } from '../CohortViewer/CohortViewer';
import { ThreePanelView } from './ThreePanelView/ThreePanelView';
import { ChatPanel } from '../ChatPanel/ChatPanel';
import { SplashPage } from './SplashPage/SplashPage';
import { TwoPanelCohortViewer } from '../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';
import { NewCohortWizard } from '../CohortViewer/NewCohortWizard';
import { StudiesGridView } from './StudiesGridView/StudiesGridView';

import styles from './MainView.module.css';
import { StudyViewerWrapper } from '../StudyViewer/StudyViewerWrapper';

export enum ViewType {
  FullPage = 'fullPage',
  Grouped = 'grouped',
  Empty = 'empty',
  StudiesGrid = 'studiesGrid',
  Phenotypes = 'phenotypes',
  Databases = 'databases',
  StudyViewer = 'studyViewer',
  CohortDefinition = 'sdef',
  PublicCohortDefinition = 'psdef',
  CohortReport = 'sreport',
  ModalPhenotype = 'modalPhenotype',
  NewCohort = 'newCohort',
  NewStudy = 'newStudy',
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
    console.log('NAVIGATING ?TO', viewInfo);
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
  const { studyId, cohortId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [currentView, setCurrentView] = useState<ViewInfo>({
    viewType: ViewType.Empty,
    data: undefined,
  });

  // Determine view based on URL
  useEffect(() => {
    const pathname = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const showOnboarding = searchParams.get('onboarding') === 'true';
    
    if (pathname === '/' || pathname === '') {
      setCurrentView({ viewType: ViewType.Empty, data: undefined });
    } else if (pathname === '/studies') {
      // Show studies grid view
      setCurrentView({ viewType: ViewType.StudiesGrid, data: undefined });
    } else if (cohortId && studyId) {
      // We have both study ID and cohort ID - show cohort view
      // If onboarding=true query param is present, show the wizard
      if (showOnboarding) {
        setCurrentView({ viewType: ViewType.NewCohort, data: cohortId });
      } else {
        setCurrentView({ viewType: ViewType.CohortDefinition, data: cohortId });
      }
    } else if (studyId) {
      // We have a study ID - show study view
      setCurrentView({ viewType: ViewType.StudyViewer, data: studyId });
    }
  }, [location.pathname, location.search, studyId, cohortId]);

  // Also listen to MainViewService for programmatic navigation
  useEffect(() => {
    const service = MainViewService.getInstance();
    const updateView = (viewInfo: ViewInfo) => {
      setCurrentView(viewInfo);
    };

    service.addListener(updateView);
    return () => service.removeListener(updateView);
  }, []);

  const renderView = () => {
    console.log("RENDERING MAIN VIEW", currentView, "URL:", location.pathname)
    
    switch (currentView.viewType) {
      case ViewType.Empty:
        return <SplashPage />;
      case ViewType.StudiesGrid:
        return <StudiesGridView />;
      case ViewType.StudyViewer:
        return <StudyViewerWrapper data={currentView.data} />;
      case ViewType.CohortDefinition:
        console.log("DISPLAYING COHORT IN MAINVIEW", currentView)
        return <TwoPanelCohortViewer data={currentView.data} />;
      case ViewType.PublicCohortDefinition:
          return <TwoPanelCohortViewer data={currentView.data} />;
      case ViewType.NewCohort:
        console.log("DISPLAYING NEW COHORT IN MAINVIEW", currentView)
        return (
          <>
            <TwoPanelCohortViewer data={currentView.data} />
            <NewCohortWizard
              isVisible={true}
              onClose={closeNewCohortWizard}
              data={currentView.data}
            />
          </>
        );
      case ViewType.NewStudy:
        return (
          <>
            <StudyViewerWrapper data={currentView.data} />
            <NewCohortWizard
              isVisible={true}
              onClose={closeNewCohortWizard}
              data={currentView.data}
            />
          </>
        );
  
      default:
        return <SplashPage />;
    }
  };

  const closeNewCohortWizard = () => {
    console.log('Closing new cohort wizard');
    // Remove the onboarding query parameter
    if (studyId && cohortId) {
      navigate(`/studies/${studyId}/cohorts/${cohortId}`, { replace: true });
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
