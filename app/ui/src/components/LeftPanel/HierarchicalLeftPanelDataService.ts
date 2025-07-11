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
import { TreeNodeData } from './HierarchicalTreeNode';
import { CohortsDataService } from './CohortsDataService';
type ChangeListener = () => void;

export class HierarchicalLeftPanelDataService {
  private static instance: HierarchicalLeftPanelDataService;
  private changeListeners: ChangeListener[] = [];
  private treeData: TreeNodeData[] = [];
  private dataService = CohortsDataService.getInstance();

  private cachedCohortNamesAndIds = null;

  private constructor() {
    this.treeData = [];
    this.updateTreeData();

    this.dataService.addListener(() => {
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

  public async updateTreeData() {
    this.cachedCohortNamesAndIds = await this.dataService.cohortNamesAndIds();
    console.log(this.cachedCohortNamesAndIds, 'ARE THE LOADED CohorTS HERE');

    this.treeData = [
      {
        id: 'cohorts',
        name: 'Cohorts',
        collapsed: false,
        // viewInfo: { viewType: ViewType.NewCohort, data: '' },
        children: [],
      },
    ];

    const cohortsNode = this.treeData.find(node => node.id === 'cohorts');

    if (this.cachedCohortNamesAndIds && this.cachedCohortNamesAndIds.length > 0) {
      if (cohortsNode?.children) {
        this.cachedCohortNamesAndIds.forEach(cohort => {
          cohortsNode.children?.push({
            id: cohort.id,
            name: cohort.name,
            viewInfo: { viewType: ViewType.CohortDefinition, data: cohort },
          });
        });
      }
    }
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

  getTreeData(): TreeNodeData[] {
    return this.treeData;
  }

  public async addNewCohort() {
    const response = await this.dataService.createNewCohort();

    const newCohort: TreeNodeData = {
      id: 'new-cohort',
      name: 'New Cohort',
      viewInfo: { viewType: ViewType.NewCohort, data: '' },
    };
    const cohortsNode = this.treeData.find(node => node.id === 'cohorts');
    if (cohortsNode && cohortsNode.children) {
      cohortsNode.children.push(newCohort);
    }
    this.notifyListeners();
    return newCohort.viewInfo;
  }
}
