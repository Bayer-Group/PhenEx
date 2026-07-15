import { Model, Actions, DockLocation } from 'flexlayout-react';

/**
 * Service to control the main view layout, specifically the right panel tabs
 */
class MainViewLayoutService {
  private static instance: MainViewLayoutService;
  private modelRef: Model | null = null;
  private tabListeners: Map<string, Set<() => void>> = new Map();
  private lastSelectedTab: string | null = null;

  private constructor() {}

  public static getInstance(): MainViewLayoutService {
    if (!MainViewLayoutService.instance) {
      MainViewLayoutService.instance = new MainViewLayoutService();
    }
    return MainViewLayoutService.instance;
  }

  public setModel(model: Model): void {
    this.modelRef = model;
  }

  /** Subscribe to a right-panel tab becoming active. Returns an unsubscribe fn. */
  public onTabActivated(tabComponent: string, callback: () => void): () => void {
    if (!this.tabListeners.has(tabComponent)) {
      this.tabListeners.set(tabComponent, new Set());
    }
    this.tabListeners.get(tabComponent)!.add(callback);
    return () => this.tabListeners.get(tabComponent)?.delete(callback);
  }

  /** Called by MainView whenever the inner model changes to detect tab switches. */
  public notifyModelChange(model: Model): void {
    const right = model.getBorderSet().getBorderMap().get(DockLocation.RIGHT);
    if (!right) return;
    const selectedIdx = right.getSelected();
    if (selectedIdx === -1) return;
    const children = right.getChildren();
    const selectedTab = children[selectedIdx];
    if (!selectedTab) return;
    const component = (selectedTab as any).getComponent?.() as string | undefined;
    if (!component || component === this.lastSelectedTab) return;
    this.lastSelectedTab = component;
    this.tabListeners.get(component)?.forEach(cb => cb());
  }

  /**
   * Open the chat tab in the right panel
   */
  public openChatTab(): void {
    if (!this.modelRef) {
      console.warn('MainViewLayoutService: Model not set, cannot open chat tab');
      return;
    }

    const border = this.modelRef.getBorderSet().getBorders().find(
      (b) => b.getLocation() === DockLocation.RIGHT
    );

    if (border) {
      // Chat tab is at index 2 (Execute=0, Constants=1, Chat=2, Issues=3)
      console.log('MainViewLayoutService: Opening Chat tab (index 2)');
      this.modelRef.doAction(Actions.updateNodeAttributes(border.getId(), { selected: 2 }));
    } else {
      console.warn('MainViewLayoutService: Right border not found');
    }
  }

  /**
   * Open a specific tab in the right panel by index
   * @param tabIndex 0=Execute, 1=Constants, 2=Chat, 3=Issues
   */
  public openRightPanelTab(tabIndex: number): void {
    if (!this.modelRef) {
      console.warn('MainViewLayoutService: Model not set, cannot open tab');
      return;
    }

    const border = this.modelRef.getBorderSet().getBorders().find(
      (b) => b.getLocation() === DockLocation.RIGHT
    );

    if (border) {
      this.modelRef.doAction(Actions.updateNodeAttributes(border.getId(), { selected: tabIndex }));
    }
  }
}

export const mainViewLayoutService = MainViewLayoutService.getInstance();
