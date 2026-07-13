import { Model, Actions, DockLocation } from 'flexlayout-react';

/**
 * Service to control the main view layout, specifically the right panel tabs
 */
class MainViewLayoutService {
  private static instance: MainViewLayoutService;
  private modelRef: Model | null = null;

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
