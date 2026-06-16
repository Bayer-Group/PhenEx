import React, { FC, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TwoPanelView } from '../../MainView/TwoPanelView/TwoPanelView';
import { CohortViewer } from '../CohortViewer';
import { CohortViewType } from '../CohortViewer';
import { CodelistsViewer } from '../../SlideoverPanels/CodelistsViewer/CodelistsViewer';
import { CohortReportView } from '../../SlideoverPanels/CohortReportView/CohortReportView';
import { ExecutePanel } from '../../SlideoverPanels/ExecutePanel/ExecutePanel';
import { DatabasePanel } from '../../SlideoverPanels/DatabasePanel/DatabasePanel';
import { ConstantsPanel } from '../../SlideoverPanels/ConstantsPanel/ConstantsPanel';
import { VisibilityPanel } from '../../SlideoverPanels/VisibilityPanel/VisibilityPanel';
import { InfoPanel } from '../../SlideoverPanels/InfoPanel/InfoPanel';
import { PhenotypePanel } from '../../SlideoverPanels/PhenotypeViewer/PhenotypePanel';
import { NewCohortWizardPanel } from '../../SlideoverPanels/NewCohortWizardPanel/NewCohortWizardPanel';
import { RightPanelHistoryDataService } from './RightPanelHistoryDataService';
import { StudyViewer } from '../../StudyViewer/StudyViewer';
import { MainViewService, ViewType } from '../../MainView/MainView';
import { StudyDataService } from '../../StudyViewer/StudyDataService';
import { SmartBreadcrumbs } from '../../../components/SmartBreadcrumbs';
import { CallToActionNavBar } from '../../../components/PhenExNavBar/CallToActionNavBar';
import { NavBarMenuProvider } from '../../../components/PhenExNavBar/PhenExNavBarMenuContext';
import { CohortDataService } from '../CohortDataService/CohortDataService';
import { CohortRightPanel } from '../CohortRightPanel/CohortRightPanel';
import { useReportMode } from '../../../contexts/ReportModeContext';
import { useThreePanelCollapse } from '../../../contexts/ThreePanelCollapseContext';
import styles from './TwoPanelCohortViewer.module.css';

interface TwoPanelCohortViewerProps {
  data?: string;
  contentMode?: 'cohort' | 'study';
}

export class TwoPanelCohortViewerService {
  private static instance: TwoPanelCohortViewerService | null = null;
  private data?: string;
  private extraData?: any;
  private currentViewType: any = CohortViewType.Info;
  private isRightPanelCollapsed: boolean = true;
  private listeners: Array<(viewType: any, extraData: any, isCollapsed: boolean) => void> = [];
  private panelRef?: React.RefObject<{ collapseSlideoverPanel: (collapse: boolean) => void; showPopover: (content: React.ReactNode) => void; hidePopover: () => void }>;


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

  public setPanelRef(ref: React.RefObject<{ collapseSlideoverPanel: (collapse: boolean) => void; showPopover: (content: React.ReactNode) => void; hidePopover: () => void }>) {
    this.panelRef = ref;
  }

  displayExtraContent = (viewType: any, data: any) => {
    console.log(`Displaying extra content for view type: ${viewType}`);
    
    // If opening phenotype panel in StudyViewer, set the correct cohort as active
    if (viewType === 'phenotype' && data?.id) {
      this.ensureCorrectCohortIsActive(data.id);
    }
    
    // Add to history
    const historyService = RightPanelHistoryDataService.getInstance();
    historyService.addToHistory(viewType, data);
    
    this.currentViewType = viewType;
    this.extraData = data;
    // Don't modify slideover state - only show popover
    this.notifyListeners();
  };

  private ensureCorrectCohortIsActive(phenotypeId: string) {
    try {
      console.log('[TwoPanelCohortViewer] ensureCorrectCohortIsActive called for phenotype:', phenotypeId);
      // Check if we're in StudyViewer context
      const mainViewService = MainViewService.getInstance();
      const currentView = mainViewService.getCurrentView();
      console.log('[TwoPanelCohortViewer] currentView:', currentView?.viewType);
      
      if (currentView?.viewType === ViewType.StudyViewer) {
        console.log('[TwoPanelCohortViewer] In StudyViewer context');
        // We're in StudyViewer - need to set the correct cohort as active
        const studyDataService = StudyDataService.getInstance();
        if (studyDataService?.cohort_definitions_service) {
          const cohortId = studyDataService.cohort_definitions_service.getCohortIdForPhenotype(phenotypeId);
          console.log('[TwoPanelCohortViewer] Found cohortId:', cohortId, 'for phenotype:', phenotypeId);
          if (cohortId) {
            console.log(`[TwoPanelCohortViewer] Setting cohort ${cohortId} as active for phenotype ${phenotypeId}`);
            studyDataService.cohort_definitions_service.setActiveCohort(cohortId);
          }
        }
      } else {
        console.log('[TwoPanelCohortViewer] Not in StudyViewer context');
      }
    } catch (error) {
      console.warn('[TwoPanelCohortViewer] Could not ensure correct cohort is active:', error);
    }
  }

  setCurrentViewAndData = (viewType: any, data: any) => {
    console.log(`Setting current view and data without adding to history: ${viewType}`);
    
    this.currentViewType = viewType;
    this.extraData = data;
    this.isRightPanelCollapsed = false;
    this.panelRef?.current?.collapseSlideoverPanel(false);
    this.notifyListeners();
  };

  hideExtraContent = () => {
    // Add to history if it was a phenotype before closing
    if (this.currentViewType === 'phenotype') {
      const historyService = RightPanelHistoryDataService.getInstance();
      historyService.addToHistory(this.currentViewType, this.extraData);
    }
    
    this.isRightPanelCollapsed = true;
    this.panelRef?.current?.collapseSlideoverPanel(true);
    this.notifyListeners();
  };

  hidePopover = () => {
    // Close popover without affecting slideover state
    this.currentViewType = null;
    this.extraData = null;
    this.notifyListeners();
  };

  public getExtraData(): any {
    return this.extraData;
  }

  public getCurrentViewType(): any {
    return this.currentViewType;
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentViewType, this.extraData, this.isRightPanelCollapsed));
  }

  public addListener(listener: (viewType: any, extraData: any, isCollapsed: boolean) => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: (viewType: any, extraData: any, isCollapsed: boolean) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
}

export const TwoPanelCohortViewer: FC<TwoPanelCohortViewerProps> = ({ data, contentMode = 'cohort' }) => {
  const navigate = useNavigate();
  const service = TwoPanelCohortViewerService.getInstance();
  const panelRef = React.useRef<{ 
    collapseSlideoverPanel: (collapse: boolean) => void;
    showPopover: (content: React.ReactNode) => void;
    hidePopover: () => void;
  }>(null);
  
  const [viewType, setViewType] = useState<any>(service.getCurrentViewType());
  const [extraData, setExtraData] = useState<any>(service.getExtraData());
  const [popoverContent, setPopoverContent] = useState<React.ReactNode>(null);
  
  // Breadcrumb state
  const [breadcrumbItems, setBreadcrumbItems] = useState<Array<{displayName: string; onClick: () => void}>>([]);
  const [editableName, setEditableName] = useState('');
  
  // Tab state
  const [currentTabIndex, setCurrentTabIndex] = useState(0);
  const { isReportMode, setReportMode } = useReportMode();
  const { isLeftPanelShown } = useThreePanelCollapse();

  React.useEffect(() => {
    service.setPanelRef(panelRef);
  }, [service]);

  // Handle right panel collapse events from TwoPanelView collapse button
  const handleRightPanelCollapse = (isCollapsed: boolean) => {
    // Update service state when collapse button is clicked (without triggering panelRef call)
    if (isCollapsed) {
      if (viewType === 'phenotype') {
        const historyService = RightPanelHistoryDataService.getInstance();
        historyService.forceAddToHistory(viewType, extraData);
      }
      service['isRightPanelCollapsed'] = true;
    } else {
      service['isRightPanelCollapsed'] = false;
    }
    service['notifyListeners']();
  };

  React.useEffect(() => {
    const updateState = (viewType: any, extraData: any, isCollapsed: boolean) => {
      setViewType(viewType);
      setExtraData(extraData);
      // Show popover when there's content (viewType is set)
      if (viewType && extraData) {
        setPopoverContent(renderPopoverContent(viewType, extraData));
        panelRef.current?.showPopover(renderPopoverContent(viewType, extraData));
      } else {
        setPopoverContent(null);
        panelRef.current?.hidePopover();
      }
    };
    
    // Subscribe to service changes
    service.addListener(updateState);
    
    // Set initial state
    const currentViewType = service.getCurrentViewType();
    const currentData = service.getExtraData();
    updateState(currentViewType, currentData, service['isRightPanelCollapsed'] !== false);
    
    return () => service.removeListener(updateState);
  }, [service]);

  // Update breadcrumbs when content mode or data changes
  useEffect(() => {
    updateBreadcrumbs();
    
    // Subscribe to data service changes
    if (contentMode === 'cohort') {
      const cohortService = CohortDataService.getInstance();
      const listener = updateBreadcrumbs;
      cohortService.addListener(listener);
      return () => cohortService.removeListener(listener);
    } else {
      const studyService = StudyDataService.getInstance();
      const listener = updateBreadcrumbs;
      studyService.addStudyDataServiceListener(listener);
      return () => studyService.removeStudyDataServiceListener(listener);
    }
  }, [contentMode, data]);
  
  service.setData(data);
  
  const updateBreadcrumbs = React.useCallback(() => {
    if (contentMode === 'cohort') {
      const cohortService = CohortDataService.getInstance();
      const items = [
        {
          displayName: 'My Studies',
          onClick: () => { window.location.href = '/studies'; },
        },
        {
          displayName: cohortService.getStudyNameForCohort() || 'Study',
          onClick: () => {
            const studyId = cohortService.cohort_data?.study_id;
            if (studyId) navigate(`/studies/${studyId}`);
          },
        },
        {
          displayName: cohortService.cohort_name || 'Unnamed Cohort',
          onClick: () => {},
        },
      ];
      setBreadcrumbItems(items);
      setEditableName(cohortService.cohort_name || 'Unnamed Cohort');
    } else {
      const studyService = StudyDataService.getInstance();
      const isPublic = studyService.study_data?.is_public || false;
      const items = [
        {
          displayName: isPublic ? 'Public Studies' : 'My Studies',
          onClick: () => { window.location.href = '/studies'; },
        },
        {
          displayName: studyService.study_name || 'Unnamed Study',
          onClick: () => {},
        },
      ];
      setBreadcrumbItems(items);
      setEditableName(studyService.study_name || 'Unnamed Study');
    }
  }, [contentMode, navigate]);
  
  const handleEditLastItem = async (newValue: string) => {
    if (contentMode === 'cohort') {
      const cohortService = CohortDataService.getInstance();
      cohortService.cohort_name = newValue;
      cohortService.cohort_data.name = newValue;
      await cohortService.saveChangesToCohort(true, false);
      setEditableName(newValue);
      updateBreadcrumbs(); // Explicitly update breadcrumbs after save
    } else {
      const studyService = StudyDataService.getInstance();
      studyService._study_name = newValue;
      await studyService.saveChangesToStudy();
      setEditableName(newValue);
      updateBreadcrumbs(); // Explicitly update breadcrumbs after save
    }
  };
  
  const handleTabChange = (index: number) => {
    setCurrentTabIndex(index);
  };

  const handleAddNewCohort = async () => {
    if (contentMode === 'study') {
      // Get the study ID from the data prop
      let studyId = data;
      if (typeof data !== 'string') {
        studyId = data?.id;
      }
      
      if (!studyId) {
        console.error('No study ID found');
        return;
      }

      // Create a new cohort via API
      const { createCohort } = await import('../../LeftPanel/studyNavigationHelpers');
      await createCohort(studyId);
      
      // Refresh the study data to show the new cohort
      const studyDataService = StudyDataService.getInstance();
      await studyDataService.refreshStudyData();
    }
  };

  const handleMenuClick = (viewType: string) => {
    if (viewType === 'export' && contentMode === 'study') {
      // Trigger export for study view
      console.log("EXPORT STUDY");
      const studyService = StudyDataService.getInstance();
      studyService.exportStudyCallback?.();
    } else {
      service.displayExtraContent(viewType, null);
    }
  };

  const handleDelete = async () => {
    if (contentMode === 'study') {
      const studyService = StudyDataService.getInstance();
      await studyService.deleteStudy();
      navigate('/');
    } else {
      const cohortService = CohortDataService.getInstance();
      await cohortService.deleteCohort();
      navigate('/');
    }
  };

  const renderRightPanel = () => {
    return null; // Removed - using renderPopoverContent instead
  };

  const renderLeftPanel = () => {
    const viewer =
      contentMode === 'study' ? (
        <StudyViewer data={data} embeddedMode={true} activeTabIndex={currentTabIndex} />
      ) : (
        <CohortViewer data={service.getData()} activeTabIndex={currentTabIndex} />
      );
    return (
      <div className={styles.leftContentWrapper}>

        <div className={styles.leftContentViewer}>{viewer}</div>
        <CallToActionNavBar
          height={44}
          mode={contentMode === 'study' ? 'studyviewer' : 'cohortviewer'}
          onSectionTabChange={handleTabChange}
          onAddButtonClick={contentMode === 'study' ? handleAddNewCohort : undefined}
          shadow={true}
          showReport={isReportMode}
          onShowReportChange={setReportMode}
        />
      </div>
    );
  };
  
  const renderPopoverContent = (viewType: any, extraData: any) => {
    if (viewType === 'phenotype') {
      return <PhenotypePanel data={extraData} />;
    } else if (viewType === 'execute') {
      return <ExecutePanel />;
    } else if (viewType === 'database') {
      return <DatabasePanel />;
    } else if (viewType === 'constants') {
      return <ConstantsPanel />;
    } else if (viewType === 'info') {
      return <InfoPanel />;
    } else if (viewType === 'codelists') {
      return <CodelistsViewer />;
    } else if (viewType === 'newcohort') {
      return <NewCohortWizardPanel data={extraData} />;
    }
    return null;
  };
  
  const renderSlideoverPanel = () => {
    return <CohortRightPanel contentMode={contentMode} />;
  };

  return (
    <NavBarMenuProvider>
      <div className={`${styles.container} ${contentMode === 'study' ? styles.studyMode : ''}`}>
        <div className={`${styles.topSection} ${isLeftPanelShown ? styles.leftPanelShown : ''}`}>
          <div className={styles.breadcrumbsContainer}>
            <SmartBreadcrumbs 
              items={breadcrumbItems} 
              onEditLastItem={handleEditLastItem}
              classNameBreadcrumbItem={styles.breadcrumbItem}
              classNameBreadcrumbLastItem={styles.breadcrumbLastItem}
              compact={false}
            />
          </div>
        </div>
        <div className={styles.contentSection}>
          <TwoPanelView 
            ref={panelRef}
            initialSizeLeft={500} 
            minSizeLeft={400}
            minSizeRight={300}
            maxSizeRight={500}
            leftContent={renderLeftPanel()}
            slideoverContent={renderSlideoverPanel()}
            popoverContent={popoverContent}
            collapseButtonTheme={'dark'}
            onSlideoverCollapse={handleRightPanelCollapse}
            onPopoverClose={() => service.hidePopover()}
            slideoverCollapsed={false}
          />
        </div>
      </div>
    </NavBarMenuProvider>
  );
};
