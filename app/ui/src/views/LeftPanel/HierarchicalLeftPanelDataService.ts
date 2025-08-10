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
import { LoginDataService } from './UserLogin/LoginDataService';

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

  private createCohortNode = (cohort: CohortData, level: number): HierarchicalTreeNode => {
      return {
        id: cohort.id,
        displayName: cohort.name,
        level: level,
        viewInfo: { viewType: ViewType.CohortDefinition, data: cohort },
        children:[],
        height:30,
        fontSize: 20,
        renderer: CohortTreeRenderer,
        collapsed: true,
        selected: false
      };
  };

  public async updateTreeData() {
    this.cachedPublicCohortNamesAndIds = await this.dataService.publicCohortNamesAndIds() || [];
    this.cachedUserCohortNamesAndIds = await this.dataService.userCohortNamesAndIds() || [];
    console.log("UPDATING THE TREE DTATA")

    const createRootNode = (id: string, displayName: string): HierarchicalTreeNode => ({
      id,
      displayName,
      level: 0,
      children: id == 'mycohorts'? createUserCohorts():createPublicCohorts(),
      viewInfo: { viewType: ViewType.CohortDefinition, data: null },
      height: 60,
      fontSize: 18,
      fontFamily: "IBMPlexSans-bold",
      collapsed: false,
      selected: false,
      hasButton: id=='mycohorts'?true:false,
      buttonTitle: "New Cohort",
      buttonOnClick: this.addNewCohort.bind(this)
    });

    const createPublicCohorts = () => {
      return this.cachedPublicCohortNamesAndIds.map(cohort => this.createCohortNode(cohort, 1));
    }
  
    const createUserCohorts = () => {
      return this.cachedUserCohortNamesAndIds.map(cohort => this.createCohortNode(cohort, 1));
    }

    console.log("CALLING UPDATE TREE DATA")
    this.treeData = [];
    if (this.loginService.isLoggedIn()){
      this.treeData.push(createRootNode('mycohorts', 'My Cohorts'))
    }
    this.treeData.push(createRootNode('publiccohorts', 'Public Cohorts'))

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

  // Set selected state for a specific node
  public selectNode(nodeId: string) {
    // First deselect all nodes
    this.deselectAllNodes(this.treeData);

    // Helper function to find and select the target node
    const findAndSelectNode = (nodes: HierarchicalTreeNode[]): boolean => {
      for (const node of nodes) {
        if (node.id === nodeId) {
          node.selected = true;
          return true;
        }
        if (node.children && findAndSelectNode(node.children as HierarchicalTreeNode[])) {
          return true;
        }
      }
      return false;
    };

    findAndSelectNode(this.treeData);
    this.notifyListeners();
  }

  public async addNewCohort() {
    console.log("ADDING NEW COHORT", this)

    const newCohortData = await this.dataService.createNewCohort()

    const newCohortNode = this.createCohortNode(newCohortData, 1)

    const cohortsNode = this.treeData.find(node => node.id === 'mycohorts');
    if (cohortsNode && cohortsNode.children) {
      console.log("ADDING THE NEW COHORT")
      cohortsNode.children.push(newCohortNode);
    }
      // Update the cache
    this.cachedUserCohortNamesAndIds.push({
      id: newCohortData.id,
      name: newCohortData.name
    });

    await this.updateTreeData();
    this.notifyListeners();
    return ViewType.CohortDefinition;
  }
}
