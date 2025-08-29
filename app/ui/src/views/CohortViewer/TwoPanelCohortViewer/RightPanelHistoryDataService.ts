import { CohortViewType } from '../CohortViewer';

export interface RightPanelHistoryItem {
  viewType: any;
  extraData?: any;
  timestamp: number;
  displayName: string;
}

export class RightPanelHistoryDataService {
  private static instance: RightPanelHistoryDataService | null = null;
  private history: RightPanelHistoryItem[] = [];
  private listeners: Array<() => void> = [];
  private maxHistorySize: number = 10;

  private constructor() {}

  public static getInstance(): RightPanelHistoryDataService {
    if (!RightPanelHistoryDataService.instance) {
      console.log(`[RightPanelHistory] Creating new instance`);
      RightPanelHistoryDataService.instance = new RightPanelHistoryDataService();
    }
    return RightPanelHistoryDataService.instance;
  }

  public addToHistory(viewType: any, extraData?: any) {
    console.log(`[RightPanelHistory] Adding to history - viewType: ${viewType}`, extraData);
    
    // Don't add duplicate consecutive entries
    const lastItem = this.getLastItem();
    if (lastItem && lastItem.viewType === viewType && this.areExtraDataEqual(lastItem.extraData, extraData)) {
      console.log(`[RightPanelHistory] Skipping duplicate entry for viewType: ${viewType}`);
      return;
    }

    const displayName = this.getDisplayName(viewType, extraData);
    const historyItem: RightPanelHistoryItem = {
      viewType,
      extraData,
      timestamp: Date.now(),
      displayName
    };

    this.history.push(historyItem);
    console.log(`[RightPanelHistory] Added item: ${displayName}, total history items: ${this.history.length}`);

    // Keep history size manageable
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
      console.log(`[RightPanelHistory] Trimmed history to ${this.maxHistorySize} items`);
    }

    this.notifyListeners();
  }

  public getHistory(): RightPanelHistoryItem[] {
    return [...this.history];
  }

  public getLastItem(): RightPanelHistoryItem | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  public getPreviousItem(): RightPanelHistoryItem | null {
    return this.history.length > 1 ? this.history[this.history.length - 2] : null;
  }

  public clearHistory() {
    console.log(`[RightPanelHistory] Clearing history - had ${this.history.length} items`);
    this.history = [];
    this.notifyListeners();
  }

  public removeLastItem() {
    if (this.history.length > 0) {
      const removedItem = this.history.pop();
      console.log(`[RightPanelHistory] Removed last item: ${removedItem?.displayName}, remaining: ${this.history.length}`);
      this.notifyListeners();
    } else {
      console.log(`[RightPanelHistory] Cannot remove last item - history is empty`);
    }
  }

  private getDisplayName(viewType: any, extraData?: any): string {
    switch (viewType) {
      case 'phenotype':
        return extraData?.name || extraData?.phenotype?.name || 'Phenotype';
      case 'report':
        return 'Report';
      case 'execute':
        return 'Execute';
      case 'database':
        return 'Database';
      case 'constants':
        return 'Constants';
      case 'visibility':
        return 'Visibility';
      case 'info':
        return 'Info';
      case 'codelists':
        return 'Codelists';
      default:
        return 'Unknown';
    }
  }

  private areExtraDataEqual(data1: any, data2: any): boolean {
    // Simple comparison - you might want to implement a deeper comparison
    if (data1 === data2) return true;
    if (!data1 || !data2) return false;
    
    // For phenotype data, compare by name or id
    if (data1.name && data2.name) {
      return data1.name === data2.name;
    }
    if (data1.id && data2.id) {
      return data1.id === data2.id;
    }
    
    return JSON.stringify(data1) === JSON.stringify(data2);
  }

  private notifyListeners() {
    console.log(`[RightPanelHistory] Notifying ${this.listeners.length} listeners`);
    this.listeners.forEach(listener => listener());
  }

  public addListener(listener: () => void) {
    this.listeners.push(listener);
    console.log(`[RightPanelHistory] Added listener, total: ${this.listeners.length}`);
  }

  public removeListener(listener: () => void) {
    const originalLength = this.listeners.length;
    this.listeners = this.listeners.filter(l => l !== listener);
    console.log(`[RightPanelHistory] Removed listener, was: ${originalLength}, now: ${this.listeners.length}`);
  }
}
