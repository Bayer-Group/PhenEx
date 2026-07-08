import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Layout, Model, IJsonModel, Actions, DockLocation } from 'flexlayout-react';
import 'flexlayout-react/style/light.css';
import { HierarchicalLeftPanel } from '../LeftPanel/HierarchicalLeftPanel';
import { RightPanel } from './RightPanel';
import { ChatPanel } from '../ChatPanel/ChatPanel';
import { SplashPage } from './SplashPage/SplashPage';
import { TwoPanelCohortViewer } from '../CohortViewer/TwoPanelCohortViewer/TwoPanelCohortViewer';
import { StudiesGridView } from './StudiesGridView/StudiesGridView';

import styles from './MainView.module.css';
import { StudyViewerWrapper } from '../StudyViewer/StudyViewerWrapper';
import { ReportModeProvider } from '../../contexts/ReportModeContext';
import {
  ThreePanelCollapseProvider,
  useThreePanelCollapse,
} from '../../contexts/ThreePanelCollapseContext';
import { CohortRightPanel } from '../CohortViewer/CohortRightPanel/CohortRightPanel';
import { StudyExecutePanel } from '../SlideoverPanels/StudyExecutePanel/StudyExecutePanel';
import { MainBreadcrumb } from './MainBreadcrumb';
import leftPanelIcon from '../../assets/icons/left_panel.svg';

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
  private currentView: ViewInfo | null = null;
  

  private constructor() {}

  public static getInstance(): MainViewService {
    if (!MainViewService.instance) {
      MainViewService.instance = new MainViewService();
    }
    return MainViewService.instance;
  }

  public navigateTo = (viewInfo: ViewInfo) => {
    console.log('NAVIGATING ?TO', viewInfo);
    this.currentView = viewInfo;
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

  public getCurrentView(): ViewInfo | null {
    return this.currentView;
  }

  public setCurrentView(viewInfo: ViewInfo) {
    this.currentView = viewInfo;
  }
}

// ── Layout constants ──────────────────────────────────────────────────────
const LEFT_BORDER_SIZE = 300;
const LEFT_BORDER_MIN = 200;
const RIGHT_BORDER_SIZE = 300;
const RIGHT_BORDER_MIN = 300;

/** Views that expose cohort/study right-panel content (Execute + Constants). */
const COHORT_STUDY_VIEWS = new Set<ViewType>([
  ViewType.StudyViewer,
  ViewType.CohortDefinition,
  ViewType.PublicCohortDefinition,
  ViewType.NewCohort,
]);

function createLayoutModel(): Model {
  const json: IJsonModel = {
    global: {
      tabEnableClose: false,
      tabEnableRename: false,
      tabEnableDrag: false,
      tabSetEnableMaximize: false,
      tabSetEnableDrop: false,
      borderEnableDrop: false,
    },
    borders: [
      {
        type: 'border',
        location: 'left',
        size: LEFT_BORDER_SIZE,
        minSize: LEFT_BORDER_MIN,
        selected: 0,
        children: [
          { type: 'tab', name: '◧', component: 'leftPanel', enableClose: false, enableDrag: false },
        ],
      },
      {
        type: 'border',
        location: 'right',
        size: RIGHT_BORDER_SIZE,
        minSize: RIGHT_BORDER_MIN,
        selected: 0,
        children: [
          { type: 'tab', name: 'Execute', component: 'execute', enableClose: false, enableDrag: false },
          { type: 'tab', name: 'Constants', component: 'constants', enableClose: false, enableDrag: false },
          { type: 'tab', name: 'Chat', component: 'chat', enableClose: false, enableDrag: false },
          { type: 'tab', name: 'Issues', component: 'issues', enableClose: false, enableDrag: false },
        ],
      },
    ],
    layout: {
      type: 'row',
      children: [
        {
          type: 'tabset',
          enableTabStrip: false,
          enableDrop: false,
          children: [
            { type: 'tab', name: 'Main', component: 'center', enableClose: false, enableDrag: false },
          ],
        },
      ],
    },
  };
  return Model.fromJson(json);
}

export const MainView = () => (
  <ThreePanelCollapseProvider>
    <MainViewInner />
  </ThreePanelCollapseProvider>
);

const MainViewInner = () => {
  const { studyId, cohortId } = useParams();
  const location = useLocation();
  const [inReportView, setInReportView] = useState(false);

  const [currentView, setCurrentView] = useState<ViewInfo>({
    viewType: ViewType.Empty,
    data: undefined,
  });

  // Determine view based on URL
  useEffect(() => {
    const pathname = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const showOnboarding = searchParams.get('onboarding') === 'true';

    let newView: ViewInfo;
    if (pathname === '/' || pathname === '') {
      newView = { viewType: ViewType.Empty, data: undefined };
    } else if (pathname === '/studies') {
      newView = { viewType: ViewType.StudiesGrid, data: undefined };
    } else if (cohortId && studyId) {
      newView = showOnboarding
        ? { viewType: ViewType.NewCohort, data: cohortId }
        : { viewType: ViewType.CohortDefinition, data: cohortId };
    } else if (studyId) {
      newView = { viewType: ViewType.StudyViewer, data: studyId };
    } else {
      newView = { viewType: ViewType.Empty, data: undefined };
    }

    setCurrentView(newView);
    MainViewService.getInstance().setCurrentView(newView);
  }, [location.pathname, location.search, studyId, cohortId]);

  // Also listen to MainViewService for programmatic navigation
  useEffect(() => {
    const service = MainViewService.getInstance();
    const updateView = (viewInfo: ViewInfo) => setCurrentView(viewInfo);
    service.addListener(updateView);
    return () => service.removeListener(updateView);
  }, []);

  const renderView = () => {
    switch (currentView.viewType) {
      case ViewType.Empty:
        return <SplashPage />;
      case ViewType.StudiesGrid:
        return <StudiesGridView />;
      case ViewType.StudyViewer:
        return <StudyViewerWrapper data={currentView.data} />;
      case ViewType.CohortDefinition:
        return <TwoPanelCohortViewer data={currentView.data} />;
      case ViewType.PublicCohortDefinition:
        return <TwoPanelCohortViewer data={currentView.data} />;
      case ViewType.NewCohort:
        return <TwoPanelCohortViewer data={currentView.data} />;
      case ViewType.NewStudy:
        return <StudyViewerWrapper data={currentView.data} />;
      default:
        return <SplashPage />;
    }
  };

  // ── FlexLayout + border collapse ─────────────────────────────────────
  const layoutModelRef = useRef<Model>(createLayoutModel());
  const {
    isLeftPanelShown,
    setLeftPanelShown,
    toggleLeftPanel,
    isRightPanelShown,
    setRightPanelShown,
  } = useThreePanelCollapse();

  const syncingRef = useRef(false);

  // Collapsing a border only toggles its `selected` attribute; the border
  // keeps its last dragged size, so re-opening restores it automatically.
  const setBorderOpen = useCallback((location: DockLocation, open: boolean) => {
    const model = layoutModelRef.current;
    const border = model.getBorderSet().getBorderMap().get(location);
    if (!border) return;
    if ((border.getSelected() !== -1) === open) return;
    syncingRef.current = true;
    model.doAction(Actions.updateNodeAttributes(border.getId(), { selected: open ? 0 : -1 }));
    syncingRef.current = false;
  }, []);

  // Sync collapse context → borders
  useEffect(() => {
    setBorderOpen(DockLocation.LEFT, isLeftPanelShown);
  }, [isLeftPanelShown, setBorderOpen]);

  useEffect(() => {
    setBorderOpen(DockLocation.RIGHT, isRightPanelShown);
  }, [isRightPanelShown, setBorderOpen]);

  const handleModelChange = useCallback((model: Model) => {
    if (syncingRef.current) return;
    const borderMap = model.getBorderSet().getBorderMap();

    const left = borderMap.get(DockLocation.LEFT);
    if (left && (left.getSelected() !== -1) !== isLeftPanelShown) {
      setLeftPanelShown(left.getSelected() !== -1);
    }

    const right = borderMap.get(DockLocation.RIGHT);
    if (right && (right.getSelected() !== -1) !== isRightPanelShown) {
      setRightPanelShown(right.getSelected() !== -1);
    }
  }, [isLeftPanelShown, isRightPanelShown, setLeftPanelShown, setRightPanelShown]);

  // ⌘B toggles the left panel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleLeftPanel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleLeftPanel]);

  const constantsContentMode =
    currentView.viewType === ViewType.StudyViewer || currentView.viewType === ViewType.NewStudy
      ? 'study'
      : 'cohort';

  const isCohortView =
    currentView.viewType === ViewType.CohortDefinition ||
    currentView.viewType === ViewType.PublicCohortDefinition ||
    currentView.viewType === ViewType.NewCohort;

  const factory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'leftPanel':
          return (
            <div className={styles.leftPanel}>
              <HierarchicalLeftPanel isVisible={true} />
            </div>
          );
        case 'center':
          return (
            <div className={styles.centerPanel}>
              <RightPanel>
                <ReportModeProvider value={inReportView} onValueChange={setInReportView}>
                  {renderView()}
                </ReportModeProvider>
              </RightPanel>
            </div>
          );
        case 'chat':
          return (
            <div className={styles.rightPanelTab}>
              <ChatPanel onTextEnter={() => { /* handled internally by ChatPanel */ }} />
            </div>
          );
        case 'execute':
          return (
            <div className={styles.rightPanelTab}>
              {COHORT_STUDY_VIEWS.has(currentView.viewType) ? (
                <StudyExecutePanel />
              ) : (
                <div className={styles.emptyPane}>No execution for this view.</div>
              )}
            </div>
          );
        case 'constants':
          return (
            <div className={styles.rightPanelTab}>
              {COHORT_STUDY_VIEWS.has(currentView.viewType) ? (
                <CohortRightPanel contentMode={constantsContentMode} />
              ) : (
                <div className={styles.emptyPane}>No constants for this view.</div>
              )}
            </div>
          );
        case 'issues':
          return <div className={styles.emptyPane} />;
        default:
          return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentView, inReportView, constantsContentMode],
  );

  return (
    <div className={styles.mainView}>
      <div className={styles.titleGroup}>
        <button
          className={styles.leftBorderCollapseBtn}
          onClick={toggleLeftPanel}
          aria-label="Toggle left panel"
        >
          <img src={leftPanelIcon} alt="" />
        </button>
        <MainBreadcrumb studyId={studyId} showCohort={isCohortView} />
      </div>
      <div className={styles.page}>
        <Layout
          model={layoutModelRef.current}
          factory={factory}
          onModelChange={handleModelChange}
        />
      </div>
    </div>
  );
};
