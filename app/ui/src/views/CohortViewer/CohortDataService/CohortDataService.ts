import { TableData, ColumnDefinition, TableRow } from '../tableTypes';
import { executeStudy } from '../../../api/execute_cohort/route';
import {
  getUserCohort,
  getPublicCohort,
  updateCohort,
  deleteCohort,
} from '../../../api/text_to_cohort/route';
import { defaultColumns } from './CohortColumnDefinitions';
import { createID } from '../../../types/createID';
import { CohortIssuesService } from '../CohortIssuesDisplay/CohortIssuesService';
import { ConstantsDataService } from '../../SlideoverPanels/ConstantsPanel/ConstantsDataService';
import { CodelistDataService } from '../../SlideoverPanels/CodelistsViewer/CodelistDataService';
import { ReportDataService } from '../../SlideoverPanels/CohortReportView/ReportDataService';

// export abstract class CohortDataService {
export class CohortDataService {
  private static instance: CohortDataService;
  public _cohort_name: string = '';
  private _cohort_data: Record<string, any> = {};
  public issues_service: CohortIssuesService;
  public constants_service: ConstantsDataService;
  public codelists_service: CodelistDataService;
  public report_service: ReportDataService;

  private _table_data: TableData = {
    rows: [],
    columns: [],
  };

  private columns: ColumnDefinition[] = defaultColumns;

  private constructor() {
    this.issues_service = new CohortIssuesService();
    this.issues_service.setDataService(this);
    this.constants_service = new ConstantsDataService();
    this.constants_service.setCohortDataService(this);
    this.codelists_service = new CodelistDataService();
    this.codelists_service.setCohortDataService(this);
    this.report_service = new ReportDataService();
    this.report_service.setCohortDataService(this);
  }

  public static getInstance(): CohortDataService {
    if (!CohortDataService.instance) {
      CohortDataService.instance = new CohortDataService();
    }
    return CohortDataService.instance;
  }

  public get cohort_name(): string {
    return this._cohort_name;
  }

  public set cohort_name(value: string) {
    this._cohort_name = value;
  }

  public get cohort_data(): Record<string, any> {
    return this._cohort_data;
  }

  public set cohort_data(value: Record<string, any>) {
    this._cohort_data = value;
  }

  public get table_data(): TableData {
    return this._table_data;
  }

  private _currentFilter: string[] = ['entry', 'inclusion', 'exclusion'];

  public tableDataFromCohortData(): TableData {
    let filteredPhenotypes = this._cohort_data.phenotypes || [];
    if (this._currentFilter.length > 0) {
      filteredPhenotypes = filteredPhenotypes.filter((phenotype: TableRow) =>
        this._currentFilter.includes(phenotype.type)
      );
    }

    // If components are included in the filter, we need hierarchical sorting
    if (this._currentFilter.includes('component')) {
      filteredPhenotypes = this.getHierarchicallyOrderedPhenotypes(filteredPhenotypes);
    }

    return {
      rows: filteredPhenotypes,
      columns: this.columns,
    };
  }

  public async loadCohortData(cohortIdentifiers: string): Promise<void> {
    try {
      let cohortResponse = undefined;
      try {
        cohortResponse = await getUserCohort(cohortIdentifiers.id);
      } catch {
        cohortResponse = await getPublicCohort(cohortIdentifiers.id);
      }

      this._cohort_data = cohortResponse;
      this.issues_service.validateCohort();
      this.sortPhenotypes();
      this._cohort_name = this._cohort_data.name || 'Unnamed Cohort';
      if (!this._cohort_data.id) {
        this._cohort_data.id = createID();
      }
      // Ensure phenotypes array exists
      if (!this._cohort_data.phenotypes) {
        this._cohort_data.phenotypes = [];
      }

      this._table_data = this.tableDataFromCohortData();
      this.constants_service.refreshConstants();
      this.notifyListeners(); // Notify listeners after loading data
    } catch (error) {
      console.error('Error loading cohort data:', error);
    }
  }

  public setDatabaseSettings(databaseConfig) {
    this._cohort_data.database_config = databaseConfig;

    // Update domain values based on mapper type
    const domainColumn = this.columns.find(col => col.field === 'domain');
    if (domainColumn) {
      // domainColumn.cellEditorParams.values = MapperDomains[databaseConfig.mapper];
    }

    // Refresh table data to reflect the updated domain values
    this.saveChangesToCohort();
  }

  public setConstants(constants) {
    this._cohort_data.constants = constants;
    this.saveChangesToCohort(false, false);
  }

  public onCellValueChanged(event: any) {
    /*
    Update phenotype data with new value from grid editor
    */
    const fieldEdited = event.colDef.field;
    const rowIdEdited = event.data.id; // TODO consider giving all phenotypes an ID
    let phenotypeEdited = this._cohort_data.phenotypes.find(
      (row: TableRow) => row.id === rowIdEdited
    );
    phenotypeEdited[fieldEdited] = event.newValue;
    this.saveChangesToCohort(true, false);
  }

  public async saveChangesToCohort(changesToCohort: boolean = true, refreshGrid: boolean = true) {
    if (changesToCohort) {
      this.sortPhenotypes();
      this.splitPhenotypesByType();
    }
    this._cohort_data.name = this._cohort_name;
    this._table_data = this.tableDataFromCohortData();
    await updateCohort(this._cohort_data.id, this._cohort_data);
    this.notifyNameChangeListeners();
    this.issues_service.validateCohort();
    if (refreshGrid) {
      this.notifyListeners();
    }
  }

  private sortPhenotypes() {
    /*
    Sort phenotypes by type. # TODO sort phenotypes by index in type
    */
    const order = ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome', 'component', 'NA'];
    let sortedPhenotypes: TableRow[] = [];
    // iterate over order, finding phenotypes of that type and appending to a new array of phenotypes
    for (const type of order) {
      let phenotypesOfType = this._cohort_data.phenotypes.filter(
        (row: TableRow) => row.type === type
      );
      // map over filtered phenotypes to assign index
      phenotypesOfType = phenotypesOfType.map((phenotype: TableRow, index: number) => ({
        ...phenotype,
        index: index + 1, // or index + 1 if you want to start from 1
      }));
      sortedPhenotypes = sortedPhenotypes.concat(phenotypesOfType);
    }
    this._cohort_data.phenotypes = sortedPhenotypes;
    this._table_data = this.tableDataFromCohortData();
  }

  private splitPhenotypesByType() {
    const types = ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'];
    const type_keys = [
      'entry_criterion',
      'inclusions',
      'exclusions',
      'characteristics',
      'outcomes',
    ];

    // iterate over order, finding phenotypes of that type and appending to a new array of phenotypes
    let i = 0;
    for (const type of types) {
      const phenotypesOfType = this._cohort_data.phenotypes.filter(
        (row: TableRow) => row.type === type
      );
      if (type == 'entry') {
        this._cohort_data.entry_criterion = phenotypesOfType[0];
      } else {
        const type_key = type_keys[i];
        this._cohort_data[type_key] = phenotypesOfType;
      }
      i++;
    }
  }

  public addPhenotype(type: string = 'NA', parentPhenotypeId: string | null = null) {
    // ensure that cohort only has one entry phenotype
    if (type === 'entry') {
      const existingEntryPhenotype = this._cohort_data.phenotypes.find(
        (row: TableRow) => row.type === 'entry'
      );
      if (existingEntryPhenotype) {
        return;
      }
    }
    const newPhenotype: TableRow = {
      id: createID(),
      type: type,
      name: 'Unnamed Phenotype',
      class_name: 'CodelistPhenotype',
      level: 0,
    };
    if (parentPhenotypeId) {
      newPhenotype.parentIds = [parentPhenotypeId];
      newPhenotype.level = (this.getAllAncestors(newPhenotype).length);
    } 


    this._cohort_data.phenotypes.push(newPhenotype);
    this.saveChangesToCohort(true, true);
  }

  public getPhenotypeById(id: string): TableRow | undefined {
    return this._cohort_data.phenotypes.find(
      (phenotype: TableRow) => phenotype.id === id
    );
  }

  public getAllAncestors(phenotypeData: TableRow): TableRow[] {
    if (!phenotypeData.parentIds || phenotypeData.parentIds.length === 0) {
      return [];
    }

    const parentId = phenotypeData.parentIds[0];
    const parentPhenotype = this.getPhenotypeById(parentId);
    
    if (!parentPhenotype) {
      return [];
    }

    // Recursively get ancestors of the parent
    const grandparents = this.getAllAncestors(parentPhenotype);
    
    // Return grandparents first, then the immediate parent
    return [...grandparents, parentPhenotype];
  }

  public getAllDescendants(phenotypeId: string): TableRow[] {
    const descendants: TableRow[] = [];
    
    // Find all direct children of this phenotype
    const directChildren = this._cohort_data.phenotypes.filter(
      (phenotype: TableRow) =>
        phenotype.parentIds && 
        Array.isArray(phenotype.parentIds) && 
        phenotype.parentIds.includes(phenotypeId)
    );
    
    // For each direct child, recursively get their descendants
    for (const child of directChildren) {
      descendants.push(child);
      const childDescendants = this.getAllDescendants(child.id);
      descendants.push(...childDescendants);
    }
    
    return descendants;
  }

  private getHierarchicallyOrderedPhenotypes(phenotypes: TableRow[]): TableRow[] {
    const result: TableRow[] = [];
    
    // Separate phenotypes by type, maintaining original order for non-components
    const order = ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'];
    const componentPhenotypes = phenotypes.filter(p => p.type === 'component');
    
    for (const type of order) {
      const phenotypesOfType = phenotypes.filter(p => p.type === type);
      
      for (const phenotype of phenotypesOfType) {
        // Add the parent phenotype
        result.push(phenotype);
        
        // Add all its component descendants in hierarchical order
        const descendants = this.getComponentDescendantsHierarchically(phenotype.id, componentPhenotypes);
        result.push(...descendants);
      }
    }
    
    // Add any orphaned components (components without parents in the filtered list)
    const addedComponentIds = new Set(result.filter(p => p.type === 'component').map(p => p.id));
    const orphanedComponents = componentPhenotypes.filter(c => !addedComponentIds.has(c.id));
    result.push(...orphanedComponents);
    
    return result;
  }

  private getComponentDescendantsHierarchically(parentId: string, componentPhenotypes: TableRow[]): TableRow[] {
    const result: TableRow[] = [];
    
    // Find direct children of this parent
    const directChildren = componentPhenotypes.filter(
      (phenotype: TableRow) =>
        phenotype.parentIds && 
        Array.isArray(phenotype.parentIds) && 
        phenotype.parentIds.includes(parentId)
    );
    
    // Sort direct children by their index if available
    directChildren.sort((a, b) => (a.index || 0) - (b.index || 0));
    
    // For each direct child, add it and then recursively add its descendants
    for (const child of directChildren) {
      result.push(child);
      const childDescendants = this.getComponentDescendantsHierarchically(child.id, componentPhenotypes);
      result.push(...childDescendants);
    }
    
    return result;
  }

  public deletePhenotype(id: string) {
    const phenotypeToDelete = this.getPhenotypeById(id);
    if (!phenotypeToDelete) {
      return null;
    }

    const idsToRemove: string[] = [id];
    
    // If this is a component phenotype, also get all its descendants
    if (phenotypeToDelete.type === 'component') {
      const descendants = this.getAllDescendants(id);
      idsToRemove.push(...descendants.map(desc => desc.id));
    }

    // Also find any component phenotypes that have this phenotype as an ancestor
    // (component phenotypes that would become orphaned)
    const componentPhenotypes = this._cohort_data.phenotypes.filter(
      (phenotype: TableRow) => phenotype.type === 'component'
    );

    for (const component of componentPhenotypes) {
      const ancestors = this.getAllAncestors(component);
      if (ancestors.some(ancestor => ancestor.id === id)) {
        if (!idsToRemove.includes(component.id)) {
          idsToRemove.push(component.id);
          // Also get descendants of this component
          const componentDescendants = this.getAllDescendants(component.id);
          componentDescendants.forEach(desc => {
            if (!idsToRemove.includes(desc.id)) {
              idsToRemove.push(desc.id);
            }
          });
        }
      }
    }

    // Remove all identified phenotypes
    this._cohort_data.phenotypes = this._cohort_data.phenotypes.filter(
      (phenotype: TableRow) => !idsToRemove.includes(phenotype.id)
    );

    this.saveChangesToCohort();
    return {
      remove: idsToRemove,
    };
  }

  public async updateRowOrder(newRowData: TableRow[]) {
    console.log('=== updateRowOrder START ===');
    console.log(
      'newRowData received:',
      newRowData.map(r => ({ id: r.id, type: r.type, name: r.name, index: r.index }))
    );
    console.log('Current filter:', this._currentFilter);

    // Get all phenotypes (including those not currently visible due to filter)
    const allPhenotypes = [...this._cohort_data.phenotypes];
    console.log(
      'All phenotypes before reorder:',
      allPhenotypes.map(p => ({ id: p.id, type: p.type, name: p.name, index: p.index }))
    );

    // If components are in the filter, handle hierarchical reordering
    if (this._currentFilter.includes('component')) {
      await this.updateHierarchicalRowOrder(newRowData, allPhenotypes);
    } else {
      // Original flat reordering logic for non-component filters
      await this.updateFlatRowOrder(newRowData, allPhenotypes);
    }

    console.log('=== updateRowOrder END ===');
  }

  private async updateFlatRowOrder(newRowData: TableRow[], allPhenotypes: TableRow[]) {
    // Group the reordered visible phenotypes by type
    const reorderedVisibleByType: { [key: string]: TableRow[] } = {};
    newRowData.forEach(row => {
      if (!reorderedVisibleByType[row.type]) {
        reorderedVisibleByType[row.type] = [];
      }
      reorderedVisibleByType[row.type].push(row);
    });
    console.log('Reordered visible by type:', reorderedVisibleByType);

    // Create a map of visible phenotype IDs for quick lookup
    const visiblePhenotypeIds = new Set(newRowData.map(row => row.id));
    console.log('Visible phenotype IDs:', Array.from(visiblePhenotypeIds));

    // Separate hidden phenotypes by type
    const hiddenPhenotypesByType: { [key: string]: TableRow[] } = {};
    allPhenotypes.forEach(phenotype => {
      if (!visiblePhenotypeIds.has(phenotype.id)) {
        if (!hiddenPhenotypesByType[phenotype.type]) {
          hiddenPhenotypesByType[phenotype.type] = [];
        }
        hiddenPhenotypesByType[phenotype.type].push(phenotype);
      }
    });
    console.log('Hidden phenotypes by type:', hiddenPhenotypesByType);

    // Rebuild the complete phenotypes array maintaining order within each type
    const order = ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome', 'component', 'NA'];
    let newCompleteOrder: TableRow[] = [];

    for (const type of order) {
      // Combine reordered visible phenotypes with hidden phenotypes for this type
      const visibleOfType = reorderedVisibleByType[type] || [];
      const hiddenOfType = hiddenPhenotypesByType[type] || [];
      const allOfType = [...visibleOfType, ...hiddenOfType];

      console.log(
        `Type ${type}: visible=${visibleOfType.length}, hidden=${hiddenOfType.length}, total=${allOfType.length}`
      );

      // Update indices within each type
      allOfType.forEach((phenotype, index) => {
        phenotype.index = index + 1;
      });

      newCompleteOrder = newCompleteOrder.concat(allOfType);
    }

    console.log(
      'New complete order:',
      newCompleteOrder.map(p => ({ id: p.id, type: p.type, name: p.name, index: p.index }))
    );

    // Update the cohort data with the complete new order
    this._cohort_data.phenotypes = newCompleteOrder;
    console.log('Updated _cohort_data.phenotypes length:', this._cohort_data.phenotypes.length);

    // Update table data before saving - do this manually to avoid sorting
    this._table_data = this.tableDataFromCohortData();
    console.log('Updated _table_data rows length:', this._table_data.rows.length);
    console.log(
      'Table data rows:',
      this._table_data.rows.map(r => ({ id: r.id, type: r.type, name: r.name, index: r.index }))
    );

    // Don't call sortPhenotypes() during drag operations as it will mess up our ordering
    this.splitPhenotypesByType();
    this._cohort_data.name = this._cohort_name;
    await updateCohort(this._cohort_data.id, this._cohort_data);
    this.notifyNameChangeListeners();
    this.issues_service.validateCohort();
    this.notifyListeners();
  }

  private async updateHierarchicalRowOrder(newRowData: TableRow[], allPhenotypes: TableRow[]) {
    console.log('=== Hierarchical reordering ===');
    
    // Create a map of all phenotypes for quick lookup
    const visibleIds = new Set(newRowData.map(r => r.id));
    
    // Separate visible phenotypes by type
    const visibleByType: { [key: string]: TableRow[] } = {};
    newRowData.forEach(row => {
      if (!visibleByType[row.type]) {
        visibleByType[row.type] = [];
      }
      visibleByType[row.type].push(row);
    });
    
    // Process the new order and update indices based on hierarchical constraints
    const newCompleteOrder: TableRow[] = [];
    const order = ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'];
    
    // First, add all non-component phenotypes and their descendants in the new order
    for (const type of order) {
      const visibleOfType = visibleByType[type] || [];
      let typeIndex = 1;
      
      for (const phenotype of visibleOfType) {
        // Update the phenotype's index within its type
        phenotype.index = typeIndex++;
        newCompleteOrder.push(phenotype);
        
        // Find all component descendants that should be placed after this parent
        const componentDescendants = this.getComponentsInNewOrder(phenotype.id, newRowData);
        newCompleteOrder.push(...componentDescendants);
      }
      
      // Add any hidden phenotypes of this type
      const hiddenOfType = allPhenotypes.filter(p => 
        p.type === type && !visibleIds.has(p.id)
      );
      for (const hidden of hiddenOfType) {
        hidden.index = typeIndex++;
        newCompleteOrder.push(hidden);
        
        // Add hidden component descendants
        const hiddenComponents = allPhenotypes.filter(comp =>
          comp.type === 'component' &&
          comp.parentIds &&
          comp.parentIds.includes(hidden.id) &&
          !visibleIds.has(comp.id)
        );
        newCompleteOrder.push(...hiddenComponents);
      }
    }
    
    // Add any orphaned components
    const addedIds = new Set(newCompleteOrder.map(p => p.id));
    const orphanedComponents = allPhenotypes.filter(p => 
      p.type === 'component' && !addedIds.has(p.id)
    );
    newCompleteOrder.push(...orphanedComponents);
    
    console.log(
      'New hierarchical order:',
      newCompleteOrder.map(p => ({ id: p.id, type: p.type, name: p.name, index: p.index, level: p.level }))
    );
    
    // Update the cohort data
    this._cohort_data.phenotypes = newCompleteOrder;
    this._table_data = this.tableDataFromCohortData();
    
    this.splitPhenotypesByType();
    this._cohort_data.name = this._cohort_name;
    await updateCohort(this._cohort_data.id, this._cohort_data);
    this.notifyNameChangeListeners();
    this.issues_service.validateCohort();
    this.notifyListeners();
  }
  
  private getComponentsInNewOrder(parentId: string, newRowData: TableRow[]): TableRow[] {
    const result: TableRow[] = [];
    
    // Find components in the new order that are direct children of this parent
    const directChildren = newRowData.filter(row =>
      row.type === 'component' &&
      row.parentIds &&
      row.parentIds.includes(parentId)
    );
    
    // Process each child and its descendants
    for (const child of directChildren) {
      result.push(child);
      const childComponents = this.getComponentsInNewOrder(child.id, newRowData);
      result.push(...childComponents);
    }
    
    return result;
  }

  // Method to validate drag-and-drop constraints for hierarchical phenotypes
  public canDropPhenotype(draggedPhenotype: TableRow, targetPhenotype: TableRow, position: 'before' | 'after' | 'inside'): boolean {
    // If components are not in the current filter, use normal rules
    if (!this._currentFilter.includes('component')) {
      // Only allow reordering within the same type
      return draggedPhenotype.type === targetPhenotype.type;
    }

    // Hierarchical rules when components are visible
    if (draggedPhenotype.type === 'component' && targetPhenotype.type === 'component') {
      // Components can only be reordered among siblings (same parent)
      const draggedParents = draggedPhenotype.parentIds || [];
      const targetParents = targetPhenotype.parentIds || [];
      
      // Check if they have the same parent
      if (draggedParents.length > 0 && targetParents.length > 0) {
        return draggedParents[0] === targetParents[0];
      }
      
      // Both are orphaned components
      return draggedParents.length === 0 && targetParents.length === 0;
    }

    if (draggedPhenotype.type !== 'component' && targetPhenotype.type !== 'component') {
      // Non-component phenotypes can be reordered within their type
      return draggedPhenotype.type === targetPhenotype.type;
    }

    if (draggedPhenotype.type !== 'component' && targetPhenotype.type === 'component') {
      // Cannot drop a parent phenotype into its component area
      const targetAncestors = this.getAllAncestors(targetPhenotype);
      return !targetAncestors.some(ancestor => ancestor.id === draggedPhenotype.id);
    }

    if (draggedPhenotype.type === 'component' && targetPhenotype.type !== 'component') {
      // Components can be dropped near their parent or other valid parents of the same type
      if (position === 'inside') {
        // Can be dropped inside a phenotype if it could be a valid parent
        return targetPhenotype.type !== 'component';
      }
      
      // For before/after positioning, it depends on the component's current parent relationship
      return true; // Allow repositioning for now, the exact rules can be refined
    }

    return false;
  }

  private isNewCohort: boolean = false;

  public isNewCohortCreation(): boolean {
    return this.isNewCohort;
  }

  public async createNewCohort() {
    /*
    Creates an in memory cohort (empty) data structure new cohort. This is not saved to disk! only when user inputs any changes to the cohort are changes made
    */
    this._cohort_data = {
      id: createID(),
      name: 'Name your cohort...',
      class_name: 'Cohort',
      phenotypes: [],
      database_config: {},
      constants: [],
    };
    this._cohort_name = this._cohort_data.name;
    this._table_data = this.tableDataFromCohortData();
    this.constants_service.refreshConstants();
    this.isNewCohort = true;
    this.notifyListeners(); // Notify listeners after initialization
    this.isNewCohort = false;
  }

  private listeners: Array<() => void> = [];

  public addListener(listener: () => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: () => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  private nameChangeListeners: Array<() => void> = [];

  // Add execution progress listeners
  private executionProgressListeners: Array<
    (message: string | any, type: 'log' | 'error' | 'result' | 'complete') => void
  > = [];

  public addExecutionProgressListener(
    listener: (message: string | any, type: 'log' | 'error' | 'result' | 'complete') => void
  ) {
    this.executionProgressListeners.push(listener);
  }

  public removeExecutionProgressListener(
    listener: (message: string | any, type: 'log' | 'error' | 'result' | 'complete') => void
  ) {
    const index = this.executionProgressListeners.indexOf(listener);
    if (index > -1) {
      this.executionProgressListeners.splice(index, 1);
    }
  }

  private notifyExecutionProgressListeners(
    message: string | any,
    type: 'log' | 'error' | 'result' | 'complete'
  ) {
    this.executionProgressListeners.forEach(listener => listener(message, type));
  }

  public addNameChangeListener(listener: () => void) {
    this.nameChangeListeners.push(listener);
  }

  public removeNameChangeListener(listener: () => void) {
    const index = this.nameChangeListeners.indexOf(listener);
    if (index > -1) {
      this.nameChangeListeners.splice(index, 1);
    }
  }

  private notifyNameChangeListeners() {
    this.nameChangeListeners.forEach(listener => listener());
  }

  public updateCohortFromChat(newCohort) {
    this._cohort_data = newCohort;
    this.sortPhenotypes();
    this.splitPhenotypesByType();
    // this._cohort_data.name = this._cohort_name;
    this._table_data = this.tableDataFromCohortData();
    this.notifyListeners();
  }

  public async executeCohort(): Promise<void> {
    try {
      const response = await executeStudy(
        {
          cohort: this._cohort_data,
          database_config: this._cohort_data.database_config,
        },
        (message: string, type: 'log' | 'error' | 'result' | 'complete') => {
          // Handle streaming messages
          console.log(`[${type.toUpperCase()}]`, message);

          // You can emit these to listeners or store them for display
          this.notifyExecutionProgressListeners(message, type);
        }
      );

      this._cohort_data = response.cohort;
      this.preparePhenexCohortForUI();
      this.saveChangesToCohort();
    } catch (error) {
      console.error('Error fetching cohort explanation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.notifyExecutionProgressListeners(`Error: ${errorMessage}`, 'error');
    }
  }

  private appendTypeKeyToPhenotypes(phenotypes: Array<Record<string, any>>, settype: string) {
    for (let i = 0; i < phenotypes.length; i++) {
      phenotypes[i].type = settype;
    }
  }

  private preparePhenexCohortForUI() {
    this._cohort_data.entry_criterion.type = 'entry';
    this.appendTypeKeyToPhenotypes(this._cohort_data.inclusions, 'inclusion');
    this.appendTypeKeyToPhenotypes(this._cohort_data.exclusions, 'exclusion');
    this.appendTypeKeyToPhenotypes(this._cohort_data.characteristics, 'baseline');
    this.appendTypeKeyToPhenotypes(this._cohort_data.outcomes, 'outcome');

    this._cohort_data.phenotypes = [this._cohort_data.entry_criterion].concat(
      this._cohort_data.inclusions,
      this._cohort_data.exclusions,
      this._cohort_data.characteristics,
      this._cohort_data.outcomes
    );
  }
  async deleteCohort() {
    if (this._cohort_data.id) {
      await deleteCohort(this._cohort_data.id);
      this._cohort_data = {};
      this._cohort_name = '';
      this._table_data = { rows: [], columns: this.columns };
      this.notifyListeners();
      this.notifyNameChangeListeners();
    }
  }

  public filterType(type: string | string[]): void {
    this._currentFilter = Array.isArray(type) ? type : [type];
    this._table_data = this.tableDataFromCohortData();
    this.notifyListeners();
  }

  public updateColumns(newColumns: ColumnDefinition[]): void {
    this.columns = newColumns;
    this._table_data = this.tableDataFromCohortData();
    console.log(this._table_data);
    this.notifyListeners();
  }

  public tableDataForComponentPhenotype(parentPhenotype): TableData {
    let filteredPhenotypes = this._cohort_data.phenotypes || [];
    if (this._currentFilter.length > 0) {
      filteredPhenotypes = filteredPhenotypes.filter(
        (phenotype: TableRow) =>
          phenotype.type === 'component' &&
          phenotype.parentIds && // Check if parentIds exists
          Array.isArray(phenotype.parentIds) && // Check if it's an array
          phenotype.parentIds.includes(parentPhenotype.id)
      );
    }
    return {
      rows: filteredPhenotypes,
      columns: this.columns,
    };
  }
}
