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
  private currentIndex: number = -1; // Current position in history
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
    const currentItem = this.getCurrentItem();
    if (currentItem && currentItem.viewType === viewType && this.areExtraDataEqual(currentItem.extraData, extraData)) {
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

    // If we're not at the end of history, remove everything after current position
    // This happens when user goes back and then navigates to a new item
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
      console.log(`[RightPanelHistory] Truncated history at index ${this.currentIndex}`);
    }

    this.history.push(historyItem);
    this.currentIndex = this.history.length - 1;
    console.log(`[RightPanelHistory] Added item: ${displayName}, total history items: ${this.history.length}, currentIndex: ${this.currentIndex}`);

    // Keep history size manageable
    if (this.history.length > this.maxHistorySize) {
      const itemsToRemove = this.history.length - this.maxHistorySize;
      this.history = this.history.slice(itemsToRemove);
      this.currentIndex -= itemsToRemove;
      console.log(`[RightPanelHistory] Trimmed history to ${this.maxHistorySize} items, new currentIndex: ${this.currentIndex}`);
    }

    this.notifyListeners();
  }

  public getHistory(): RightPanelHistoryItem[] {
    return [...this.history];
  }

  public getCurrentItem(): RightPanelHistoryItem | null {
    return this.currentIndex >= 0 && this.currentIndex < this.history.length ? this.history[this.currentIndex] : null;
  }

  public getLastItem(): RightPanelHistoryItem | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  public getPreviousItem(): RightPanelHistoryItem | null {
    return this.currentIndex > 0 ? this.history[this.currentIndex - 1] : null;
  }

  public getNextItem(): RightPanelHistoryItem | null {
    return this.currentIndex < this.history.length - 1 ? this.history[this.currentIndex + 1] : null;
  }

  public canGoBack(): boolean {
    return this.currentIndex > 0;
  }

  public canGoForward(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  public goBack(): RightPanelHistoryItem | null {
    if (this.canGoBack()) {
      this.currentIndex--;
      console.log(`[RightPanelHistory] Went back to index ${this.currentIndex}: ${this.getCurrentItem()?.displayName}`);
      this.notifyListeners();
      return this.getCurrentItem();
    }
    console.log(`[RightPanelHistory] Cannot go back - already at beginning`);
    return null;
  }

  public goForward(): RightPanelHistoryItem | null {
    if (this.canGoForward()) {
      this.currentIndex++;
      console.log(`[RightPanelHistory] Went forward to index ${this.currentIndex}: ${this.getCurrentItem()?.displayName}`);
      this.notifyListeners();
      return this.getCurrentItem();
    }
    console.log(`[RightPanelHistory] Cannot go forward - already at end`);
    return null;
  }

  public clearHistory() {
    console.log(`[RightPanelHistory] Clearing history - had ${this.history.length} items`);
    this.history = [];
    this.currentIndex = -1;
    this.notifyListeners();
  }

  public removeLastItem() {
    if (this.history.length > 0) {
      const removedItem = this.history.pop();
      if (this.currentIndex >= this.history.length) {
        this.currentIndex = this.history.length - 1;
      }
      console.log(`[RightPanelHistory] Removed last item: ${removedItem?.displayName}, remaining: ${this.history.length}, currentIndex: ${this.currentIndex}`);
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
