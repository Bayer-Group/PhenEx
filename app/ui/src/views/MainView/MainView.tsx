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
import { StudyIssuesPanel } from '../SlideoverPanels/StudyIssuesPanel/StudyIssuesPanel';
import { MainBreadcrumb } from './MainBreadcrumb';
import leftPanelIcon from '../../assets/icons/left_panel.svg';
import { UserLogin } from '../LeftPanel/UserLogin/UserLogin';
import { ExportButton } from '../../components/ExportButton/ExportButton';
import { mainViewLayoutService } from './MainViewLayoutService';

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
const EXECUTE_TAB_ID = 'executePanelTab';
const ISSUES_TAB_ID = 'issuesPanelTab';

/** Views that expose cohort/study right-panel content (Info + Execute). */
const COHORT_STUDY_VIEWS = new Set<ViewType>([
  ViewType.StudyViewer,
  ViewType.CohortDefinition,
  ViewType.PublicCohortDefinition,
  ViewType.NewCohort,
]);

const GLOBAL_LAYOUT_OPTIONS = {
  tabEnableClose: false,
  tabEnableRename: false,
  tabEnableDrag: false,
  tabSetEnableMaximize: false,
  tabSetEnableDrop: false,
  borderEnableDrop: false,
} as const;

const EXECUTE_LAYOUT_OPTIONS = {
  ...GLOBAL_LAYOUT_OPTIONS,
  tabEnableDrag: true,
  tabSetEnableDrop: true,
  borderEnableDrop: true,
} as const;

/**
 * Outer layout: left panel (collapsible border) alongside the main region.
 * The main region hosts the title bar and the inner layout.
 */
function createOuterLayoutModel(): Model {
  const json: IJsonModel = {
    global: GLOBAL_LAYOUT_OPTIONS,
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
    ],
    layout: {
      type: 'row',
      children: [
        {
          type: 'tabset',
          enableTabStrip: false,
          enableDrop: false,
          children: [
            { type: 'tab', name: 'Main', component: 'mainRegion', enableClose: false, enableDrag: false },
          ],
        },
      ],
    },
  };
  return Model.fromJson(json);
}

/**
 * Inner layout: center content alongside the right panel (collapsible border).
 * Lives inside the main region, below the title bar.
 */
function createInnerLayoutModel(): Model {
  const json: IJsonModel = {
    global: GLOBAL_LAYOUT_OPTIONS,
    borders: [
      {
        type: 'border',
        location: 'right',
        size: RIGHT_BORDER_SIZE,
        minSize: RIGHT_BORDER_MIN,
        selected: 0,
        children: [
          { type: 'tab', name: 'Info', component: 'info', enableClose: false, enableDrag: false },
          { type: 'tab', name: 'Execute', component: 'execute', enableClose: false, enableDrag: false },
          { type: 'tab', name: 'Chat', component: 'chat', enableClose: false, enableDrag: false },
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
            { type: 'tab', name: 'Center', component: 'center', enableClose: false, enableDrag: false },
          ],
        },
      ],
    },
  };
  return Model.fromJson(json);
}

// tabEnableClose: false,
//       tabEnableRename: false,
//       tabEnableDrag: true,
//       tabSetEnableMaximize: false,
//       tabSetEnableDrop: true,
//       borderEnableDrop: true,


function createExecuteLayoutModel(): Model {
  const json: IJsonModel = {
    global: EXECUTE_LAYOUT_OPTIONS,
    borders: [],
    layout: {
      type: 'row',
      children: [
        {
          type: 'tabset',
          enableDeleteWhenEmpty: false,
          enableDrop: true,
          children: [
            { type: 'tab', id: EXECUTE_TAB_ID, name: 'Execute', component: 'executePanel', enableClose: false, enableDrag: true },
            { type: 'tab', id: ISSUES_TAB_ID, name: 'Issues', component: 'issuesPanel', enableClose: false, enableDrag: true },
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
  // Outer layout owns the left border; inner layout owns the right border.
  const outerModelRef = useRef<Model>(createOuterLayoutModel());
  const innerModelRef = useRef<Model>(createInnerLayoutModel());
  const executeModelRef = useRef<Model>(createExecuteLayoutModel());
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
  const setBorderOpen = useCallback((model: Model, location: DockLocation, open: boolean) => {
    const border = model.getBorderSet().getBorderMap().get(location);
    if (!border) return;
    if ((border.getSelected() !== -1) === open) return;
    syncingRef.current = true;
    model.doAction(Actions.updateNodeAttributes(border.getId(), { selected: open ? 0 : -1 }));
    syncingRef.current = false;
  }, []);

  // Sync collapse context → borders
  useEffect(() => {
    setBorderOpen(outerModelRef.current, DockLocation.LEFT, isLeftPanelShown);
  }, [isLeftPanelShown, setBorderOpen]);

  useEffect(() => {
    setBorderOpen(innerModelRef.current, DockLocation.RIGHT, isRightPanelShown);
  }, [isRightPanelShown, setBorderOpen]);

  // Set up the layout service with the inner model (which has the right border)
  useEffect(() => {
    mainViewLayoutService.setModel(innerModelRef.current);
    mainViewLayoutService.setExecuteModel(executeModelRef.current);
  }, []);

  // Hide right panel when on studies grid or empty view, show it for cohort/study views
  // (but only when entering from a non-cohort/study view, so navigating within cohort/study
  //  views — e.g. StudyViewer → CohortDefinition — doesn't force the panel open again)
  const prevViewTypeRef = useRef<ViewType | null>(null);
  useEffect(() => {
    const prev = prevViewTypeRef.current;
    prevViewTypeRef.current = currentView.viewType;

    if (currentView.viewType === ViewType.StudiesGrid || currentView.viewType === ViewType.Empty) {
      setRightPanelShown(false);
    } else if (COHORT_STUDY_VIEWS.has(currentView.viewType) && (prev === null || !COHORT_STUDY_VIEWS.has(prev))) {
      setRightPanelShown(true);
    }
  }, [currentView.viewType, setRightPanelShown]);

  const handleOuterModelChange = useCallback((model: Model) => {
    if (syncingRef.current) return;
    const left = model.getBorderSet().getBorderMap().get(DockLocation.LEFT);
    if (left && (left.getSelected() !== -1) !== isLeftPanelShown) {
      setLeftPanelShown(left.getSelected() !== -1);
    }
  }, [isLeftPanelShown, setLeftPanelShown]);

  const handleInnerModelChange = useCallback((model: Model) => {
    if (syncingRef.current) return;
    
    mainViewLayoutService.setModel(model);
    mainViewLayoutService.notifyModelChange(model);
    
    const right = model.getBorderSet().getBorderMap().get(DockLocation.RIGHT);
    if (right && (right.getSelected() !== -1) !== isRightPanelShown) {
      setRightPanelShown(right.getSelected() !== -1);
    }
  }, [isRightPanelShown, setRightPanelShown]);

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

  const infoContentMode =
    currentView.viewType === ViewType.StudyViewer || currentView.viewType === ViewType.NewStudy
      ? 'study'
      : 'cohort';

  const isCohortView =
    currentView.viewType === ViewType.CohortDefinition ||
    currentView.viewType === ViewType.PublicCohortDefinition ||
    currentView.viewType === ViewType.NewCohort;

  const executePanelFactory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'executePanel':
          return <StudyExecutePanel />;
        case 'issuesPanel':
          return <StudyIssuesPanel />;
        default:
          return null;
      }
    },
    [],
  );

  const factory = useCallback(
    (node: { getComponent: () => string | undefined }) => {
      switch (node.getComponent()) {
        case 'leftPanel':
          return (
            <div className={styles.leftPanel}>
              <HierarchicalLeftPanel isVisible={true} />
            </div>
          );
        case 'mainRegion':
          return (
            <div className={styles.mainRegion}>
              <div className={styles.titleGroup}>
                <button
                  className={styles.leftBorderCollapseBtn}
                  onClick={toggleLeftPanel}
                  aria-label="Toggle left panel"
                >
                  <img src={leftPanelIcon} alt="" />
                </button>
                <MainBreadcrumb studyId={studyId} showCohort={isCohortView} />
                <div className={styles.titleGroupRight}>
                  <ExportButton studyId={studyId ?? null} />
                  <UserLogin />
                </div>
              </div>
              <div 
                className={`${styles.page} ${styles.innerPage}`}
                style={{
                  ...(currentView.viewType === ViewType.StudiesGrid || currentView.viewType === ViewType.Empty
                    ? {
                        '--right-border-display': 'none',
                      } as React.CSSProperties
                    : {})
                }}
              >
                <style>{`
                  ${currentView.viewType === ViewType.StudiesGrid || currentView.viewType === ViewType.Empty ? `
                    .${styles.page} .flexlayout__border_right,
                    .${styles.page} .flexlayout__layout_main + .flexlayout__splitter_border {
                      display: none !important;
                    }
                  ` : ''}
                `}</style>
                <Layout
                  model={innerModelRef.current}
                  factory={factory}
                  onModelChange={handleInnerModelChange}
                />
              </div>
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
        case 'info':
          return (
            <div className={styles.rightPanelTab}>
              {COHORT_STUDY_VIEWS.has(currentView.viewType) ? (
                <CohortRightPanel contentMode={infoContentMode} />
              ) : (
                <div className={styles.emptyPane}>No info for this view.</div>
              )}
            </div>
          );
        case 'execute':
          return (
            <div className={styles.rightPanelTab}>
              {COHORT_STUDY_VIEWS.has(currentView.viewType) ? (
                <div className={styles.nestedTabLayout}>
                  <Layout model={executeModelRef.current} factory={executePanelFactory} />
                </div>
              ) : (
                <div className={styles.emptyPane}>No execution for this view.</div>
              )}
            </div>
          );
        default:
          return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentView, executePanelFactory, inReportView, infoContentMode, studyId, isCohortView, toggleLeftPanel, handleInnerModelChange],
  );

  return (
    <div className={styles.mainView}>
      <div className={styles.page}>
        <Layout
          model={outerModelRef.current}
          factory={factory}
          onModelChange={handleOuterModelChange}
        />
      </div>
    </div>
  );
};
