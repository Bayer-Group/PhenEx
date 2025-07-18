import React, { FC, useState } from 'react';
import { TwoPanelView } from '../../MainView/TwoPanelView/TwoPanelView';
import { CohortViewer } from '../CohortViewer';
import { CohortViewType } from '../CohortViewer';
import { PhenotypeViewer } from '../../PhenotypeViewer/PhenotypeViewer';
import { CodelistsViewer } from '../../CodelistsViewer/CodelistsViewer';
import { CohortReportView } from '../../CohortViewer/CohortReportView/CohortReportView';
import { ExecutePanel } from '../../ExecutePanel/ExecutePanel';

interface TwoPanelCohortViewerProps {
  data?: string;
}

export class TwoPanelCohortViewerService {
  private static instance: TwoPanelCohortViewerService | null = null;
  private data?: string;
  private extraData?: any;
  private panelRef?: React.RefObject<{ collapseRightPanel: (collapse: boolean) => void }>;
  private currentViewType: CohortViewType = CohortViewType.Info;
  private listeners: Array<() => void> = [];

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

  public displayExtraContent = (viewType: CohortViewType, data: any) => {
    console.log(`Displaying extra content for view type: ${viewType}`);
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

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  public addListener(listener: () => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: () => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
}

export const TwoPanelCohortViewer: FC<TwoPanelCohortViewerProps> = ({ data }) => {
  const service = TwoPanelCohortViewerService.getInstance();
  const panelRef = React.useRef<{ collapseRightPanel: (collapse: boolean) => void }>(null);
  service.setPanelRef(panelRef);
  const [viewType, setViewType] = useState<CohortViewType>(service.currentViewType);
  const [extraData, setExtraData] = useState<any>(service.getExtraData());

  React.useEffect(() => {
    const updateState = () => {
      setViewType(service.currentViewType);
      setExtraData(service.getExtraData());
    };
    updateState();
    // Subscribe to service changes
    service.addListener(updateState);
    return () => service.removeListener(updateState);
  }, [service]);
  service.setData(data);

  const renderRightPanel = () => {
    if (viewType === 'phenotype') {
      return <PhenotypeViewer data={extraData} />;
    } else if (viewType === 'report') {
      return <CohortReportView />;
    } else if (viewType === 'execute') {
      return <ExecutePanel />;
    }
    return <CodelistsViewer />;
  };

  return (
    <TwoPanelView ref={panelRef} split="vertical" initialSizeLeft={500} minSizeLeft={400}>
      <CohortViewer data={service.getData()} />
      {renderRightPanel()}
    </TwoPanelView>
  );
};
