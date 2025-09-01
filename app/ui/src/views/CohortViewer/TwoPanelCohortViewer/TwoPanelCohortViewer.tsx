import React, { FC, useState } from 'react';
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
import { RightPanelHistoryDataService } from './RightPanelHistoryDataService';
import { RightPanelHistory } from './RightPanelHistory';

interface TwoPanelCohortViewerProps {
  data?: string;
}

export class TwoPanelCohortViewerService {
  private static instance: TwoPanelCohortViewerService | null = null;
  private data?: string;
  private extraData?: any;
  private panelRef?: React.RefObject<{ collapseRightPanel: (collapse: boolean) => void }>;
  private currentViewType: any = CohortViewType.Info;
  private listeners: Array<(viewType: any, extraData: any) => void> = [];

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

  public setPanelRef(ref: React.RefObject<{ collapseRightPanel: (collapse: boolean) => void }>) {
    this.panelRef = ref;
  }

  public displayExtraContent = (viewType: any, data: any) => {
    console.log(`Displaying extra content for view type: ${viewType}`);
    
    // Add to history
    const historyService = RightPanelHistoryDataService.getInstance();
    historyService.addToHistory(viewType, data);
    
    this.currentViewType = viewType;
    this.extraData = data;
    this.panelRef?.current?.collapseRightPanel(false);
    this.notifyListeners();
  };

  public setCurrentViewAndData = (viewType: any, data: any) => {
    console.log(`Setting current view and data without adding to history: ${viewType}`);
    
    this.currentViewType = viewType;
    this.extraData = data;
    this.panelRef?.current?.collapseRightPanel(false);
    this.notifyListeners();
  };

  public hideExtraContent = () => {
    this.panelRef?.current?.collapseRightPanel(true);
    this.notifyListeners();
  };

  public getExtraData(): any {
    return this.extraData;
  }

  public getCurrentViewType(): any {
    return this.currentViewType;
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentViewType, this.extraData));
  }

  public addListener(listener: (viewType: any, extraData: any) => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: (viewType: any, extraData: any) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
}

export const TwoPanelCohortViewer: FC<TwoPanelCohortViewerProps> = ({ data }) => {
  const service = TwoPanelCohortViewerService.getInstance();
  const panelRef = React.useRef<{ collapseRightPanel: (collapse: boolean) => void }>(null);
  service.setPanelRef(panelRef);
  const [viewType, setViewType] = useState<any>(service.getCurrentViewType());
  const [extraData, setExtraData] = useState<any>(service.getExtraData());

  React.useEffect(() => {
    const updateState = (viewType: any, extraData: any) => {
      setViewType(viewType);
      setExtraData(extraData);
    };
    updateState(service.getCurrentViewType(), service.getExtraData());
    // Subscribe to service changes
    service.addListener(updateState);
    return () => service.removeListener(updateState);
  }, [service]);
  service.setData(data);

  const renderRightPanel = () => {
    // Add to history when rendering a panel
    const historyService = RightPanelHistoryDataService.getInstance();
    historyService.addToHistory(viewType, extraData);

    if (viewType === 'phenotype') {
      return <PhenotypePanel data={extraData} />;
    } else if (viewType === 'report') {
      return <CohortReportView />;
    } else if (viewType === 'execute') {
      return <ExecutePanel />;
    } else if (viewType === 'database') {
      return <DatabasePanel />;
    } else if (viewType === 'constants') {
      return <ConstantsPanel />;
    } else if (viewType === 'visibility') {
      return <VisibilityPanel />;
    } else if (viewType === 'info') {
      return <InfoPanel />;
    } else if (viewType === 'codelists') {
      return <CodelistsViewer />;
    }
  };

  return (
    <TwoPanelView 
      ref={panelRef} 
      split="vertical" 
      initialSizeLeft={500} 
      minSizeLeft={400}
      collapseButtonTheme={viewType === 'phenotype' ? 'light' : 'dark'}
    >
      <>
        <CohortViewer data={service.getData()} />
        <RightPanelHistory />

      </>
      {renderRightPanel()}
    </TwoPanelView>
  );
};
