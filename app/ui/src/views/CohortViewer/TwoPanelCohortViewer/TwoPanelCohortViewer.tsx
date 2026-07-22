import { FC, useState, useEffect } from 'react';
import { CohortViewer } from '../CohortViewer';
import { PhenotypeHorizontalRowViewer } from '../../SlideoverPanels/PhenotypeViewer/PhenotypeHorizontalRowViewer/PhenotypeHorizontalRowViewer';
import { StudyViewer } from '../../StudyViewer/StudyViewer';
import { MainViewService, ViewType } from '../../MainView/MainView';
import { StudyDataService } from '../../StudyViewer/StudyDataService';
import { NavBarMenuProvider } from '../../../components/PhenExNavBar/PhenExNavBarMenuContext';
import { CohortDataService } from '../CohortDataService/CohortDataService';
import { chatPanelDataService } from '../../ChatPanel/ChatPanelDataService';
import { useReportMode } from '../../../contexts/ReportModeContext';
import styles from './TwoPanelCohortViewer.module.css';

interface TwoPanelCohortViewerProps {
  data?: string;
  contentMode?: 'cohort' | 'study';
}

type ViewerListener = (viewType: any, extraData: any) => void;

/**
 * Tracks the phenotype detail popover shown over the cohort/study viewer.
 * The other side panels (Execute, Constants, Chat, …) now live in the MainView
 * FlexLayout, so this service only drives the modal popover selection.
 */
export class TwoPanelCohortViewerService {
  private static instance: TwoPanelCohortViewerService | null = null;
  private data?: string;
  private extraData?: any;
  private currentViewType: any = null;
  private listeners: ViewerListener[] = [];

  private constructor() {}

  public static getInstance(): TwoPanelCohortViewerService {
    if (!TwoPanelCohortViewerService.instance) {
      TwoPanelCohortViewerService.instance = new TwoPanelCohortViewerService();
    }
    return TwoPanelCohortViewerService.instance;
  }

  public setData(data?: string) {
    this.data = data;
  }

  public getData(): string | undefined {
    return this.data;
  }

  /** Open the phenotype detail popover. */
  displayExtraContent = (viewType: any, data: any) => {
    if (viewType === 'phenotype' && data?.id) {
      this.ensureCorrectCohortIsActive(data.id);
    }
    this.currentViewType = viewType;
    this.extraData = data;
    this.notifyListeners();
  };

  /** Close the popover. */
  hidePopover = () => {
    this.currentViewType = null;
    this.extraData = null;
    this.notifyListeners();
  };

  /** Alias for panels that close themselves. */
  hideExtraContent = () => this.hidePopover();

  public getExtraData(): any {
    return this.extraData;
  }

  public getCurrentViewType(): any {
    return this.currentViewType;
  }

  public addListener(listener: ViewerListener) {
    this.listeners.push(listener);
  }

  public removeListener(listener: ViewerListener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentViewType, this.extraData));
  }

  /**
   * When a phenotype is opened from the StudyViewer, make sure its owning
   * cohort is the active one so edits target the right cohort.
   */
  private ensureCorrectCohortIsActive(phenotypeId: string) {
    try {
      const currentView = MainViewService.getInstance().getCurrentView();
      if (currentView?.viewType !== ViewType.StudyViewer) return;

      const studyDataService = StudyDataService.getInstance();
      const cohortId =
        studyDataService?.cohort_definitions_service?.getCohortIdForPhenotype(phenotypeId);
      if (cohortId) {
        studyDataService.cohort_definitions_service.setActiveCohort(cohortId);
      }
    } catch (error) {
      console.warn('[TwoPanelCohortViewer] Could not ensure correct cohort is active:', error);
    }
  }
}

export const TwoPanelCohortViewer: FC<TwoPanelCohortViewerProps> = ({ data, contentMode = 'cohort' }) => {
  const service = TwoPanelCohortViewerService.getInstance();
  const [extraData, setExtraData] = useState<any>(service.getExtraData());
  const [isPhenotypeOpen, setIsPhenotypeOpen] = useState(
    service.getCurrentViewType() === 'phenotype'
  );
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const { isReportMode, setReportMode } = useReportMode();

  service.setData(data);

  // Sync popover visibility with the service.
  useEffect(() => {
    const update: ViewerListener = (viewType, data) => {
      setIsPhenotypeOpen(viewType === 'phenotype');
      setExtraData(data);
    };
    service.addListener(update);
    update(service.getCurrentViewType(), service.getExtraData());
    return () => service.removeListener(update);
  }, [service]);

  // Keep chatPanelDataService in study mode whenever a cohort is open.
  // study_id is always defined for cohorts in this app; cohort_id is passed as a hint.
  useEffect(() => {
    const cohortService = CohortDataService.getInstance();
    const syncChatMode = () => {
      const studyId = cohortService.cohort_data?.study_id as string | undefined;
      const cohortId = cohortService.cohort_data?.id as string | undefined;
      if (studyId) chatPanelDataService.setStudyMode(studyId, cohortId);
    };
    syncChatMode();
    cohortService.addListener(syncChatMode);
    return () => cohortService.removeListener(syncChatMode);
  }, []);

  const handleAddNewCohort = async () => {
    if (contentMode !== 'study') return;
    const studyId = typeof data === 'string' ? data : (data as any)?.id;
    if (!studyId) {
      console.error('No study ID found');
      return;
    }
    const { createCohort } = await import('../../LeftPanel/studyNavigationHelpers');
    await createCohort(studyId);
    await StudyDataService.getInstance().refreshStudyData();
  };

  const viewer =
    contentMode === 'study' ? (
      <StudyViewer
        data={data}
        embeddedMode={true}
        activeTabIndex={currentTabIndex}
        navMode="studyviewer"
        navShadow={true}
        onSectionTabChange={setCurrentTabIndex}
        onAddButtonClick={handleAddNewCohort}
        showReport={isReportMode}
        onShowReportChange={setReportMode}
      />
    ) : (
      <CohortViewer
        data={service.getData()}
        activeTabIndex={currentTabIndex}
        navMode="cohortviewer"
        navShadow={true}
        onSectionTabChange={setCurrentTabIndex}
        showReport={isReportMode}
        onShowReportChange={setReportMode}
      />
    );

  return (
    <NavBarMenuProvider>
      <div className={`${styles.container} ${contentMode === 'study' ? styles.studyMode : ''}`}>
        <div className={styles.contentSection}>
          <div className={styles.leftContentWrapper}>
            <div className={styles.leftContentViewer}>{viewer}</div>
          </div>
        </div>

        {isPhenotypeOpen && extraData && (
          <PhenotypeHorizontalRowViewer data={extraData} onClose={() => service.hidePopover()} />
        )}
      </div>
    </NavBarMenuProvider>
  );
};
