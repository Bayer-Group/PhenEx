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
import { StudyTreeRenderer } from './StudyTreeListItem';
import { CohortsDataService, StudyData, CohortData as ServiceCohortData } from './CohortsDataService';
import { MainViewService } from '../MainView/MainView';
import { getCurrentUser, onUserChange } from '@/auth/userProviderBridge';

interface CohortData {
  id: string;
  name: string;
  study_id?: string;
}

interface StudyTreeData extends StudyData {
  cohorts?: CohortData[];
  expanded?: boolean;
}

type ChangeListener = () => void;

export class HierarchicalLeftPanelDataService {
  private static instance: HierarchicalLeftPanelDataService;
  private changeListeners: ChangeListener[] = [];
  private treeData: HierarchicalTreeNode[] = [];
  private dataService = CohortsDataService.getInstance();

  private cachedPublicCohortNamesAndIds: CohortData[] = [];
  private cachedUserCohortNamesAndIds: CohortData[] = [];
  private cachedUserStudies: StudyData[] = [];
  private cachedPublicStudies: StudyData[] = [];

  private constructor() {
    this.treeData = [];
    this.updateTreeData();

    this.dataService.addListener(() => {
      // When cohort data changes, refresh the cohort names and IDs
      this.updateTreeData();
    });

    // Listen for auth user changes to rebuild tree if needed
    onUserChange(() => {
      this.updateTreeData();
    });
  }

  static getInstance(): HierarchicalLeftPanelDataService {
    if (!HierarchicalLeftPanelDataService.instance) {
      HierarchicalLeftPanelDataService.instance = new HierarchicalLeftPanelDataService();
    }
    return HierarchicalLeftPanelDataService.instance;
  }

  private createCohortNode = (
    cohort: CohortData,
    level: number,
    isSelected: boolean = false
  ): HierarchicalTreeNode => {
    return {
      id: cohort.id,
      displayName: cohort.name,
      level: level,
      viewInfo: { viewType: ViewType.PublicCohortDefinition, data: cohort },
      children: [],
      height: 30,
      fontSize: 16,
      renderer: CohortTreeRenderer,
      collapsed: true,
      selected: isSelected,
    };
  };

  private createStudyNode = async (
    study: StudyData,
    level: number,
    isSelected: boolean = false,
    isPublic: boolean = false
  ): Promise<HierarchicalTreeNode> => {
    console.log(`📁 Creating study node: "${study.name}" (${study.id})`);
    
    // Always load cohorts since they're already cached from workspace loading
    const cohorts = await this.dataService.getCohortsForStudy(study.id);
    console.log(`� Study "${study.name}" has ${cohorts.length} cohorts:`, cohorts.map(c => c.name));
    
    const children = cohorts.map(cohort => 
      this.createCohortNode(cohort, level + 1, cohort.id === this.getCurrentlySelectedNodeId())
    );

    const studyNode = {
      id: study.id,
      displayName: study.name,
      level: level,
      viewInfo: { viewType: ViewType.CohortDefinition, data: study },
      children: children,
      height: 35,
      fontSize: 16,
      renderer: StudyTreeRenderer,
      collapsed: true, // Start collapsed - TreeListItem will manage its own state
      selected: isSelected,
      hasButton: !isPublic,
      buttonTitle: 'Add Cohort',
      buttonOnClick: () => this.addNewCohortToStudy(study.id),
      hideButton: true, // Hide button by default, show on hover
    };
    
    console.log(`📁 Study node created: "${study.name}", children: ${children.length}`);
    return studyNode;
  };

  public async updateTreeData() {
    console.log('🔄 updateTreeData called - preserving selection states');

    // Capture currently selected node ID before rebuilding
    const currentlySelectedNodeId = this.getCurrentlySelectedNodeId();
    console.log('🔄 Currently selected node ID:', currentlySelectedNodeId);

    // Load complete workspace with error handling
    try {
      await this.dataService.loadUserWorkspace();
      this.cachedUserStudies = await this.dataService.getUserStudies();
      this.cachedPublicStudies = await this.dataService.getPublicStudies();
    } catch (error) {
      console.warn('🚨 Failed to load workspace, likely auth not ready:', error);
      // Set empty arrays and return early if auth not ready
      this.cachedUserStudies = [];
      this.cachedPublicStudies = [];
      
      // Build minimal tree structure without data
      const createEmptyRootNode = (id: string, displayName: string): HierarchicalTreeNode => ({
        id,
        displayName,
        level: 0,
        children: [],
        viewInfo: { viewType: ViewType.CohortDefinition, data: null },
        height: 60,
        fontSize: 18,
        fontFamily: 'IBMPlexSans-bold',
        collapsed: false,
        selected: id === currentlySelectedNodeId,
        hasButton: id === 'mystudies' ? true : false,
        buttonTitle: 'New',
        buttonOnClick: this.addNewStudy.bind(this),
      });
      
      this.treeData = [];
      if (!getCurrentUser()?.isAnonymous) {
        this.treeData.push(createEmptyRootNode('mystudies', 'My Studies'));
      }
      this.treeData.push(createEmptyRootNode('publicstudies', 'Public Studies'));
      
      this.notifyListeners();
      return;
    }

    const createUserStudies = async () => {
      const studyNodes: HierarchicalTreeNode[] = [];
      for (const study of this.cachedUserStudies) {
        const studyNode = await this.createStudyNode(study, 1, study.id === currentlySelectedNodeId);
        studyNodes.push(studyNode);
      }
      return studyNodes;
    };

    const createPublicStudies = async () => {
      const studyNodes: HierarchicalTreeNode[] = [];
      for (const study of this.cachedPublicStudies) {
        const studyNode = await this.createStudyNode(study, 1, study.id === currentlySelectedNodeId, true);
        studyNodes.push(studyNode);
      }
      return studyNodes;
    };

    const createRootNode = async (id: string, displayName: string): Promise<HierarchicalTreeNode> => ({
      id,
      displayName,
      level: 0,
      children: id === 'mystudies' ? await createUserStudies() : await createPublicStudies(),
      viewInfo: { viewType: ViewType.CohortDefinition, data: null },
      height: 60,
      fontSize: 18,
      fontFamily: 'IBMPlexSans-bold',
      collapsed: false,
      selected: id === currentlySelectedNodeId,
      hasButton: id === 'mystudies' ? true : false,
      buttonTitle: 'New',
      buttonOnClick: this.addNewStudy.bind(this),
    });

    this.treeData = [];
    if (!getCurrentUser()?.isAnonymous) {
      this.treeData.push(await createRootNode('mystudies', 'Studies'));
    }
    this.treeData.push(await createRootNode('publicstudies', 'Public'));

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
      console.log(
        '🎯 Selection state after 100ms:',
        selectedNode ? selectedNode.selected : 'NODE NOT FOUND'
      );
    }, 100);
  }

  public async addNewStudy() {
    const newStudyData = await this.dataService.createNewStudy();
    
    await this.updateTreeData();
    this.notifyListeners();

    if (newStudyData) {
      console.log('CREATING NEW STUDY:', newStudyData);
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo({ viewType: ViewType.NewCohort, data: newStudyData });
    }

    return ViewType.CohortDefinition;
  }

  public async addNewCohortToStudy(studyId: string) {
    const newCohortData = await this.dataService.createNewCohort(studyId);
    
    await this.updateTreeData();
    this.notifyListeners();

    if (newCohortData) {
      console.log('CREATING NEW COHORT FOR STUDY:', studyId, newCohortData);
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo({ viewType: ViewType.NewCohort, data: newCohortData });
    }

    return ViewType.CohortDefinition;
  }



  // Legacy method - deprecated but kept for compatibility
  public async addNewCohort() {
    // For now, create a new study when this is called
    return this.addNewStudy();
  }
}
