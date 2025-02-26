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

import { PhenexDirectoryParserService } from '../../services/PhenexDirectoryParserService';
import { ViewType } from '../MainView/MainView';
import { TreeNodeData } from './HierarchicalTreeNode';

type ChangeListener = () => void;

export class HierarchicalLeftPanelDataService {
  private static instance: HierarchicalLeftPanelDataService;
  private changeListeners: ChangeListener[] = [];
  private treeData: TreeNodeData[] = [];
  private parser: PhenexDirectoryParserService;

  private constructor() {
    this.parser = PhenexDirectoryParserService.getInstance();
    this.setupDirectoryListener();
    this.treeData = [];
  }

  static getInstance(): HierarchicalLeftPanelDataService {
    if (!HierarchicalLeftPanelDataService.instance) {
      HierarchicalLeftPanelDataService.instance = new HierarchicalLeftPanelDataService();
    }
    return HierarchicalLeftPanelDataService.instance;
  }

  private setupDirectoryListener() {
    this.parser.addListener(() => {
      this.updateTreeData();
    });
  }

  private async updateTreeData() {
    const cohorts = await this.parser.getCohortNames();

    this.treeData = [
      { id: 'allphenotypes', name: 'Phenotypes', viewInfo: { viewType: ViewType.Phenotypes } },
      { id: 'databases', name: 'Databases', viewInfo: { viewType: ViewType.Databases } },
      {
        id: 'cohorts',
        name: 'Cohorts',
        collapsed: false,
        children: [],
      },
    ];

    const cohortsNode = this.treeData.find(node => node.id === 'cohorts');
  
    cohortsNode?.children?.push({
      id: 'add_cohort',
      name: '+ New Cohort',
      viewInfo: { viewType: ViewType.NewCohort, data: '' },
    });
    if (cohorts && cohorts.length > 0) {
      if (cohortsNode?.children) {
        cohorts.forEach((cohort, index) => {
          cohortsNode.children?.push({
            id: `${index + 1}`,
            name: cohort,
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
}
