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

import { ViewInfo, ViewType } from '../MainView/MainView';
import { CohortsDataService, StudyData, CohortData as ServiceCohortData } from './CohortsDataService';
import { MainViewService } from '../MainView/MainView';
import { getCurrentUser, onUserChange } from '@/auth/userProviderBridge';

export interface HierarchicalTreeNode {
  id: string;
  displayName?: string;
  level?: number;
  viewInfo?: ViewInfo;
  children?: HierarchicalTreeNode[];
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  collapsed?: boolean;
  selected?: boolean;
  hasButton?: boolean;
  buttonTitle?: string;
  buttonOnClick?: () => void;
  hideButton?: boolean;
  onClick?: () => void;
}

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
      console.log('🔔 HierarchicalLeftPanelDataService: CohortsDataService changed, updating tree...');
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
    
    // Always load cohorts since they're already cached from workspace loading
    const cohorts = await this.dataService.getCohortsForStudy(study.id);
    study['cohorts'] = cohorts
    
    const children = cohorts.map(cohort => 
      this.createCohortNode(cohort, level + 1, cohort.id === this.getCurrentlySelectedNodeId())
    );

    const studyNode = {
      id: study.id,
      displayName: study.name,
      level: level,
      viewInfo: { viewType: ViewType.StudyViewer, data: study.id },
      children: children,
      height: 35,
      fontSize: 16,
      // renderer: StudyTreeRenderer,
      collapsed: true, // Start collapsed - TreeListItem will manage its own state
      selected: isSelected,
      hasButton: !isPublic,
      buttonTitle: 'New',
      buttonOnClick: () => this.addNewCohortToStudy(study.id),
      hideButton: true, // Hide button by default, show on hover
    };
    
    return studyNode;
  };

  public async updateTreeData() {
    console.log('🔄 HierarchicalLeftPanelDataService: updateTreeData called');

    // Capture currently selected node ID before rebuilding
    const currentlySelectedNodeId = this.getCurrentlySelectedNodeId();

    // Load complete workspace with error handling
    try {
      await this.dataService.loadUserWorkspace();
      this.cachedUserStudies = await this.dataService.getUserStudies();
      this.cachedPublicStudies = await this.dataService.getPublicStudies();
      console.log('🔄 HierarchicalLeftPanelDataService: Fetched studies, user:', this.cachedUserStudies.length, 'public:', this.cachedPublicStudies.length);
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
      
      // Add "New Study" action item at the top
      // studyNodes.push({
      //   id: 'new-study-action',
      //   displayName: '+ New Study',
      //   level: 1,
      //   viewInfo: { viewType: ViewType.CohortDefinition, data: null },
      //   children: [],
      //   height: 35,
      //   fontSize: 16,
      //   renderer: StudyTreeRenderer,
      //   collapsed: true,
      //   selected: false,
      //   onClick: () => this.addNewStudy(),
      // });
      
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
      viewInfo: { viewType: ViewType.Empty, data: { navigateTo: '/studies' } },
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
      this.treeData.push(await createRootNode('mystudies', 'My Studies'));
    }
    this.treeData.push(await createRootNode('publicstudies', 'Public'));

    console.log('🔄 HierarchicalLeftPanelDataService: Tree rebuilt, notifying', this.changeListeners.length, 'listeners');
    this.notifyListeners();
  }

  private notifyListeners() {
    console.log('📢 HierarchicalLeftPanelDataService: Notifying listeners');
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
    // Return a new array reference to ensure React detects changes
    return [...this.treeData];
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

    const found = findAndSelectNode(this.treeData);

    this.notifyListeners();

    // Add a small delay to check if selection state persists
    setTimeout(() => {
      const selectedNode = this.findNodeById(nodeId);
    }, 100);
  }

  public async addNewStudy() {
    // Create a new study and navigate to it
    const newStudyPromise = this.dataService.createNewStudy();
    
    // Get the study data immediately (it's created synchronously)
    const newStudyData = await newStudyPromise;
    
    // Note: updateTreeData will be triggered by the listener we set up in constructor
    // when dataService.notifyListeners() is called from createNewStudy
    
    if (newStudyData) {
      console.log('✅ Created new study:', newStudyData);
      // Navigate to the study viewer (don't create a cohort yet)
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo({ 
        viewType: ViewType.StudyViewer, 
        data: newStudyData.id 
      });
    }

    // Handle errors in background
    newStudyPromise.catch(error => {
      console.error('❌ Failed to save new study to backend:', error);
      // Tree will be updated by the revert in createNewStudy()
    });

    return ViewType.StudyViewer;
  }

  public async addNewCohortToStudy(study_data: any) {
    // Don't await - let it happen in background
    const newCohortPromise = this.dataService.createNewCohort(study_data);
    
    // Get the cohort data immediately (it's created synchronously)
    const newCohortData = await newCohortPromise;
    
    // Note: updateTreeData will be triggered by the listener we set up in constructor
    // when dataService.notifyListeners() is called from createNewCohort
    
    if (newCohortData) {
      console.log('CREATING NEW COHORT FOR STUDY:', study_data.id, newCohortData);
      const mainViewService = MainViewService.getInstance();
      mainViewService.navigateTo({ viewType: ViewType.NewCohort, data: newCohortData });
    }

    // Handle errors in background
    newCohortPromise.catch(error => {
      console.error('❌ Failed to save new cohort to backend:', error);
      // Tree will be updated by the revert in createNewCohort()
    });

    return ViewType.CohortDefinition;
  }



  // Legacy method - deprecated but kept for compatibility
  public async addNewCohort() {
    // For now, create a new study when this is called
    return this.addNewStudy();
  }

  /**
   * Reorder studies within a category (user or public)
   * @param parentId 'mystudies' or 'publicstudies'
   * @param studyId The ID of the study being moved
   * @param newIndex The target index position
   */
  public async reorderStudy(parentId: string, studyId: string, newIndex: number) {
    
    // Determine which study array to reorder
    const studyArray = parentId === 'mystudies' ? this.cachedUserStudies : this.cachedPublicStudies;
    
    // Find current index
    const currentIndex = studyArray.findIndex(s => s.id === studyId);
    if (currentIndex === -1) {
      console.error(`❌ Study ${studyId} not found in ${parentId}`);
      return;
    }
    
    // Remove from current position
    const [movedStudy] = studyArray.splice(currentIndex, 1);
    
    // Insert at new position
    studyArray.splice(newIndex, 0, movedStudy);
    
    
    // Update display_order for all affected studies
    const studyOrders = studyArray.map((study, index) => ({
      study_id: study.id,
      display_order: index
    }));
    
    // Persist to backend
    try {
      await this.dataService.updateStudiesDisplayOrder(studyOrders);
    } catch (error) {
      console.error('❌ Failed to persist display order:', error);
    }
    
    // Update tree data and notify listeners
    await this.updateTreeData();
  }

  /**
   * Reorder cohorts within a study
   * @param studyId The ID of the study containing the cohorts
   * @param cohortId The ID of the cohort being moved
   * @param newIndex The target index position
   */
  public async reorderCohort(studyId: string, cohortId: string, newIndex: number) {
    console.log(`🔄 reorderCohort: Moving cohort ${cohortId} to index ${newIndex} in study ${studyId}`);
    
    try {
      // Clear and reload cohorts to ensure we have fresh data
      this.dataService.clearStudyCohortsCache(studyId);
      const cohorts = await this.dataService.getCohortsForStudy(studyId);
      
      if (!cohorts || cohorts.length === 0) {
        console.error(`❌ No cohorts found for study ${studyId}`);
        return;
      }
      
      
      // Find current index
      const currentIndex = cohorts.findIndex(c => c.id === cohortId);
      if (currentIndex === -1) {
        console.error(`❌ Cohort ${cohortId} not found in study ${studyId}`);
        return;
      }
      
      
      // Remove from current position
      const [movedCohort] = cohorts.splice(currentIndex, 1);
      
      // Insert at new position
      cohorts.splice(newIndex, 0, movedCohort);
      
      
      // Update display_order for all affected cohorts
      const cohortOrders = cohorts.map((cohort, index) => ({
        cohort_id: cohort.id,
        display_order: index
      }));
      
      
      // Persist to backend
      await this.dataService.updateCohortsDisplayOrder(studyId, cohortOrders);
      
      // Clear cache again to force fresh load
      this.dataService.clearStudyCohortsCache(studyId);
      
      // Update tree data and notify listeners
      await this.updateTreeData();
    } catch (error) {
      console.error('❌ Failed to reorder cohort:', error);
    }
  }

  /**
   * Update study name
   * @param studyId The ID of the study to rename
   * @param newName The new name for the study
   */
  public async updateStudyName(studyId: string, newName: string) {
    console.log(`✏️ updateStudyName: Renaming study ${studyId} to "${newName}"`);
    
    try {
      // Update the study name via the data service
      await this.dataService.updateStudyData(studyId, { name: newName });
      console.log('✅ Study name updated successfully');
      
      // Update cached studies
      const userStudy = this.cachedUserStudies.find(s => s.id === studyId);
      if (userStudy) {
        userStudy.name = newName;
      }
      
      const publicStudy = this.cachedPublicStudies.find(s => s.id === studyId);
      if (publicStudy) {
        publicStudy.name = newName;
      }
      
      // Update tree data and notify listeners
      await this.updateTreeData();
    } catch (error) {
      console.error('❌ Failed to update study name:', error);
      throw error;
    }
  }

  /**
   * Update cohort name
   * @param cohortId The ID of the cohort to rename
   * @param newName The new name for the cohort
   */
  public async updateCohortName(cohortId: string, newName: string) {
    console.log(`✏️ updateCohortName: Renaming cohort ${cohortId} to "${newName}"`);
    
    try {
      // Load the cohort data using CohortDataService
      const cohortDataService = this.dataService['cohortDataService'];
      
      // Find which study this cohort belongs to
      let studyId: string | undefined;
      for (const study of [...this.cachedUserStudies, ...this.cachedPublicStudies]) {
        const cohorts = await this.dataService.getCohortsForStudy(study.id);
        if (cohorts.some(c => c.id === cohortId)) {
          studyId = study.id;
          break;
        }
      }
      
      if (!studyId) {
        console.error('❌ Could not find study for cohort');
        return;
      }
      
      // Load the cohort, update the name, and save
      await cohortDataService.loadCohortData(cohortId);
      cohortDataService.cohort_name = newName;
      await cohortDataService.saveChangesToCohort();
      
      console.log('✅ Cohort name updated successfully');
      
      // Clear cache and update tree data
      this.dataService.clearStudyCohortsCache(studyId);
      await this.updateTreeData();
    } catch (error) {
      console.error('❌ Failed to update cohort name:', error);
      throw error;
    }
  }
}
