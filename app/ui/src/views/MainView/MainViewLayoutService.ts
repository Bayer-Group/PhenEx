import { Model, Actions, DockLocation } from 'flexlayout-react';

/**
 * Service to control the main view layout, specifically the right panel tabs
 */
class MainViewLayoutService {
  private static instance: MainViewLayoutService;
  private modelRef: Model | null = null;
  private executeModelRef: Model | null = null;

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

  public setExecuteModel(model: Model): void {
    this.executeModelRef = model;
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
      // Chat tab is at index 2 (Info=0, Execute=1, Chat=2)
      console.log('MainViewLayoutService: Opening Chat tab (index 2)');
      this.modelRef.doAction(Actions.updateNodeAttributes(border.getId(), { selected: 2 }));
    } else {
      console.warn('MainViewLayoutService: Right border not found');
    }
  }

  /**
   * Open a specific tab in the right panel by index
    * @param tabIndex 0=Info, 1=Execute, 2=Chat
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

  public openExecuteIssuesTab(): void {
    this.openRightPanelTab(1);

    if (!this.executeModelRef) {
      console.warn('MainViewLayoutService: Execute model not set, cannot open issues tab');
      return;
    }

    this.executeModelRef.doAction(Actions.selectTab('issuesPanelTab'));
  }
}

export const mainViewLayoutService = MainViewLayoutService.getInstance();
