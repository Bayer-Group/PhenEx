/**
 * HierarchicalLeftPanelDataService
 *
 * This service manages the hierarchical tree data structure for the left panel navigation.
 * It maintains a tree of nodes representing Phenotypes, Databases, and Cohorts with their
 * respective children.
 *
 * Event Listener Chain:
 * 1. DirectoryReaderWriterService: Monitors file system changes and notifies listeners
 * 2. PhenexDirectoryParserService: Receives directory updates, parses cohort files, and notifies listeners
 * 3. HierarchicalLeftPanelDataService (this service): Updates tree data based on parsed cohorts
 * 4. HierarchicalLeftPanel Component: Renders the updated tree structure
 *
 * The service follows the Singleton pattern to ensure a single source of truth for the
 * tree data structure across the application.
 */

import { ViewType } from '../MainView/MainView';
import { CohortTreeRenderer, HierarchicalTreeNode } from './CohortTreeListItem';
import { CohortsDataService } from './CohortsDataService';
import { LoginDataService } from '@/views/LeftPanel/UserLogin/LoginDataService';
import { MainViewService } from '../MainView/MainView';

interface CohortData {
  id: string;
  name: string;
}

type ChangeListener = () => void;

export class HierarchicalLeftPanelDataService {
  private static instance: HierarchicalLeftPanelDataService;
  private changeListeners: ChangeListener[] = [];
  private treeData: HierarchicalTreeNode[] = [];
  private dataService = CohortsDataService.getInstance();
  private loginService = LoginDataService.getInstance();

  private cachedPublicCohortNamesAndIds: CohortData[] = [];
  private cachedUserCohortNamesAndIds: CohortData[] = [];

  private constructor() {
    this.treeData = [];
    this.updateTreeData();

    this.dataService.addListener(() => {
      // When cohort data changes, refresh the cohort names and IDs
      this.updateTreeData();
    });

    this.loginService.addListener(() => {
      // When cohort data changes, refresh the cohort names and IDs
      this.updateTreeData();
    });
  }

  static getInstance(): HierarchicalLeftPanelDataService {
    if (!HierarchicalLeftPanelDataService.instance) {
      HierarchicalLeftPanelDataService.instance = new HierarchicalLeftPanelDataService();
    }
    return HierarchicalLeftPanelDataService.instance;
  }

  private createCohortNode = (cohort: CohortData, level: number, isSelected: boolean = false): HierarchicalTreeNode => {
    return {
      id: cohort.id,
      displayName: cohort.name,
      level: level,
      viewInfo: { viewType: ViewType.PublicCohortDefinition, data: cohort },
      children: [],
      height: 30,
      fontSize: 20,
      renderer: CohortTreeRenderer,
      collapsed: true,
      selected: isSelected,
    };
  };

  public async updateTreeData() {
    console.log('🔄 updateTreeData called - preserving selection states');
    
    // Capture currently selected node ID before rebuilding
    const currentlySelectedNodeId = this.getCurrentlySelectedNodeId();
    console.log('🔄 Currently selected node ID:', currentlySelectedNodeId);
    
    this.cachedPublicCohortNamesAndIds = (await this.dataService.publicCohortNamesAndIds()) || [];
    this.cachedUserCohortNamesAndIds = (await this.dataService.userCohortNamesAndIds()) || [];

    const createRootNode = (id: string, displayName: string): HierarchicalTreeNode => ({
      id,
      displayName,
      level: 0,
      children: id == 'mycohorts' ? createUserCohorts() : createPublicCohorts(),
      viewInfo: { viewType: ViewType.CohortDefinition, data: null },
      height: 60,
      fontSize: 18,
      fontFamily: 'IBMPlexSans-bold',
      collapsed: false,
      selected: id === currentlySelectedNodeId,
      hasButton: id == 'mycohorts' ? true : false,
      buttonTitle: 'New Cohort',
      buttonOnClick: this.addNewCohort.bind(this),
    });

    const createPublicCohorts = () => {
      return this.cachedPublicCohortNamesAndIds.map(cohort => 
        this.createCohortNode(cohort, 1, cohort.id === currentlySelectedNodeId)
      );
    };

    const createUserCohorts = () => {
      return this.cachedUserCohortNamesAndIds.map(cohort => 
        this.createCohortNode(cohort, 1, cohort.id === currentlySelectedNodeId)
      );
    };

    this.treeData = [];
    if (this.loginService.isLoggedIn()) {
      this.treeData.push(createRootNode('mycohorts', 'My Cohorts'));
    }
    this.treeData.push(createRootNode('publiccohorts', 'Public Cohorts'));

    console.log('🔄 Tree rebuilt with preserved selection for:', currentlySelectedNodeId);
    this.notifyListeners();
  }

  private notifyListeners() {
    this.changeListeners.forEach(listener => listener());
  }

  addListener(listener: ChangeListener) {
    this.changeListeners.push(listener);
  }

  removeListener(listener: ChangeListener) {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  getTreeData(): HierarchicalTreeNode[] {
    return this.treeData;
  }

  // Recursively deselect all nodes in the tree
  private deselectAllNodes(nodes: HierarchicalTreeNode[]) {
    nodes.forEach(node => {
      node.selected = false;
      if (node.children) {
        this.deselectAllNodes(node.children as HierarchicalTreeNode[]);
      }
    });
  }

  // Helper method to find a node by ID
  private findNodeById(nodeId: string): HierarchicalTreeNode | null {
    const findInNodes = (nodes: HierarchicalTreeNode[]): HierarchicalTreeNode | null => {
      for (const node of nodes) {
        if (node.id === nodeId) {
          return node;
        }
        if (node.children) {
          const found = findInNodes(node.children as HierarchicalTreeNode[]);
          if (found) return found;
        }
      }
      return null;
    };
    return findInNodes(this.treeData);
  }

  // Helper method to get the currently selected node ID
  private getCurrentlySelectedNodeId(): string | null {
    const findSelectedNode = (nodes: HierarchicalTreeNode[]): string | null => {
      for (const node of nodes) {
        if (node.selected) {
          return node.id;
        }
        if (node.children) {
          const found = findSelectedNode(node.children as HierarchicalTreeNode[]);
          if (found) return found;
        }
      }
      return null;
    };
    return findSelectedNode(this.treeData);
  }

  // Set selected state for a specific node
  public selectNode(nodeId: string) {
    console.log('🎯 selectNode called with nodeId:', nodeId);
    
    // First deselect all nodes
    this.deselectAllNodes(this.treeData);

    // Helper function to find and select the target node
    const findAndSelectNode = (nodes: HierarchicalTreeNode[]): boolean => {
      for (const node of nodes) {
        if (node.id === nodeId) {
          console.log('🎯 Found and selecting node:', node.displayName, 'with id:', node.id);
          node.selected = true;
          return true;
        }
        if (node.children && findAndSelectNode(node.children as HierarchicalTreeNode[])) {
          return true;
        }
      }
      return false;
    };

    const found = findAndSelectNode(this.treeData);
    console.log('🎯 Node selection result:', found ? 'SUCCESS' : 'FAILED');
    
    this.notifyListeners();
    
    // Add a small delay to check if selection state persists
    setTimeout(() => {
      const selectedNode = this.findNodeById(nodeId);
      console.log('🎯 Selection state after 100ms:', selectedNode ? selectedNode.selected : 'NODE NOT FOUND');
    }, 100);
  }

  public async addNewCohort() {
    const newCohortData = await this.dataService.createNewCohort();
    const newCohortNode = this.createCohortNode(newCohortData, 1);

    const cohortsNode = this.treeData.find(node => node.id === 'mycohorts');
    if (cohortsNode && cohortsNode.children) {
      cohortsNode.children.push(newCohortNode);
    }
    // Update the cache
    this.cachedUserCohortNamesAndIds.push({
      id: newCohortData.id,
      name: newCohortData.name,
    });

    await this.updateTreeData();
    this.notifyListeners();

    if (newCohortData) {
      console.log('GETTING NEW COHORT DATA');
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo({ viewType: ViewType.NewCohort, data: newCohortData });
    } else {
      console.log('NO DATA');
    }

    return ViewType.CohortDefinition;
  }
}
