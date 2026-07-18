import { TableData, ColumnDefinition, TableRow } from '../tableTypes';
import {
  createCohort,
  updateCohort,
  deleteCohort,
  updateCohortDatabaseConfig,
  getUserCohort,
} from '../../../api/text_to_cohort/route';

import { defaultColumns, componentPhenotypeColumns } from './CohortColumnDefinitions';
import { createID } from '../../../types/createID';
import { CohortIssuesService } from '../CohortIssuesDisplay/CohortIssuesService';
import { ConstantsDataService } from '../../SlideoverPanels/ConstantsPanel/ConstantsDataService';
import { CodelistDataService } from '../../SlideoverPanels/CodelistsViewer/CodelistDataService';
import { ReportDataService } from '../../SlideoverPanels/CohortReportView/ReportDataService';
import { CohortExecutionService } from './CohortExecutionService';

export class CohortModel {
  public _cohort_name: string = '';
  private _cohort_data: Record<string, any> = {};
  private _study_data: Record<string, any> = {};
  private _database: Record<string, any> | null = null;

  public issues_service: CohortIssuesService;
  public constants_service: ConstantsDataService;
  public codelists_service: CodelistDataService;
  public report_service: ReportDataService;
  public execution_service: CohortExecutionService;

  private _table_data: TableData = {
    rows: [],
    columns: [],
  };

  private columns: ColumnDefinition[] = defaultColumns as ColumnDefinition[];

  private proto_constants = {
    f_baseline_period: {
      anchor_phenotype: null,
      class_name: "RelativeTimeRangeFilter",
      max_days: {
        class_name: "Value",
        operator: "<=",
        value: 365,
      },
      min_days: {
        class_name: "Value",
        operator: ">=",
        value: 0,
      },
      useConstant: false,
      useIndexDate: true,
      when: "before",
    },
    f_followup_period:{
      anchor_phenotype: null,
      class_name: "RelativeTimeRangeFilter",
      max_days: {
        class_name: "Value",
        operator: "<=",
        value: 365,
      },
      min_days: {
        class_name: "Value",
        operator: ">=",
        value: 0,
      },
      useConstant: false,
      useIndexDate: true,
      when: "after",
    }

  }


  constructor() {
    this.issues_service = new CohortIssuesService();
    this.issues_service.setDataService(this);
    this.constants_service = new ConstantsDataService();
    this.constants_service.setCohortDataService(this);
    this.codelists_service = new CodelistDataService();
    this.codelists_service.setCohortDataService(this);
    this.report_service = new ReportDataService();
    this.report_service.setCohortDataService(this);
    this.execution_service = new CohortExecutionService();
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

  public getStudyIdForCohort(): string | null {
    // First try _study_data.id, then fall back to _cohort_data.study_id
    return this._study_data?.id || this._cohort_data?.study_id || null;
  }

  public getStudyNameForCohort(): string {
    return this._study_data?.name || 'Unknown Study';
  }

  public get table_data(): TableData {
    return this._table_data;
  }

  private _currentFilter: string[] = ['entry', 'inclusion', 'exclusion'];
  private _showComponents: boolean = true;
  // Max component depth to show in the main cohort table. Level 0 = no
  // children (root phenotypes only), level 1 = direct children, level 2 = their
  // children, etc. `Infinity` shows every generation.
  private _componentLevel: number = Number.POSITIVE_INFINITY;
  private _showFullCodelists: boolean = false;
  private _diff_map: Map<string, 'added' | 'modified' | 'deleted'> = new Map();
  private _deleted_phenotypes: any[] = [];

  public computeDiff(basePhenotypes: any[]): void {
    this._diff_map.clear();
    this._deleted_phenotypes = [];
    const baseMap = new Map(basePhenotypes.map((p: any) => [p.id, p]));
    const provisionalIds = new Set((this._cohort_data.phenotypes || []).map((p: any) => p.id));
    for (const p of (this._cohort_data.phenotypes || [])) {
      if (!baseMap.has(p.id)) {
        this._diff_map.set(p.id, 'added');
      } else {
        const base = baseMap.get(p.id)!;
        if (base.name !== p.name || base.type !== p.type || base.class_name !== p.class_name) {
          this._diff_map.set(p.id, 'modified');
        }
      }
    }
    for (const [id, basePhenotype] of baseMap) {
      if (!provisionalIds.has(id)) {
        this._deleted_phenotypes.push({ ...basePhenotype, colorCellBackground: true, _ai_diff: 'deleted' });
      }
    }
    this._table_data = this.tableDataFromCohortData();
    this.notifyListeners();
  }

  public clearDiff(): void {
    this._diff_map.clear();
    this._deleted_phenotypes = [];
  }

  public async loadDiff(): Promise<void> {
    const cohortId = this._cohort_data?.id;
    const studyId = this._cohort_data?.study_id;
    if (!cohortId || !studyId || this._cohort_data.is_provisional !== true) return;
    try {
      const baseResponse = await getUserCohort(studyId, cohortId, false);
      const basePhenotypes = baseResponse?.cohort_data?.phenotypes ?? [];
      this.computeDiff(basePhenotypes);
    } catch (e) {
      console.warn('[CohortModel] Could not load base version for diff:', e);
    }
  }

  public tableDataFromCohortData(): TableData {
    let filteredPhenotypes = this._cohort_data.phenotypes || [];
    if (this._currentFilter.length > 0) {
      filteredPhenotypes = filteredPhenotypes.filter((phenotype: TableRow) =>
        this._currentFilter.includes(phenotype.type)
      );
    }

    // If _showComponents is true and components exist, include them hierarchically
    if (this._showComponents) {
      // Include component phenotypes in the result with hierarchical ordering
      const allPhenotypes = this._cohort_data.phenotypes || [];
      // Only include components whose effective_type matches the current filter
      // This ensures we don't show components whose root parent is filtered out
      const componentPhenotypes = allPhenotypes.filter((row: TableRow) => 
        row.type === 'component' && 
        row.effective_type && 
        this._currentFilter.includes(row.effective_type) &&
        this.getComponentDepth(row) < this._componentLevel
      );
      if (componentPhenotypes.length > 0) {
        filteredPhenotypes = this.getHierarchicallyOrderedPhenotypes([...filteredPhenotypes, ...componentPhenotypes]);
      }
    }

    // Add colorCellBackground property to enable background colors
    const phenotypesWithColorSettings = filteredPhenotypes.map((phenotype: any) => ({
      ...phenotype,
      colorCellBackground: true,
      _ai_diff: this._diff_map.get(phenotype.id) ?? undefined,
    }));

    // Append deleted phenotypes so they appear as struck-through rows
    const filteredDeleted = this._deleted_phenotypes.filter((p: any) =>
      this._currentFilter.length === 0 || this._currentFilter.includes(p.type)
    );

    return {
      rows: [...phenotypesWithColorSettings, ...filteredDeleted],
      columns: this.columns,
    };
  }

  public loadCohortData(cohortData: any): void {
    // try {
      let cohortResponse = undefined;
      // if (cohortData == undefined){
      //   try {
      //     cohortResponse = await getUserCohort(cohortData.id);
      //   } catch {
      //     cohortResponse = await getPublicCohort(cohortData.id);
      //   }
      // } 
      cohortResponse = cohortData.cohort_data;

      this._study_data = cohortData.study
      this._cohort_data = cohortResponse;
      this._database = cohortData.database ?? null;
      
      // Preserve is_provisional flag from top-level cohortData (only if explicitly true or false)
      // Backend always returns this field, so we need to copy it
      this._cohort_data.is_provisional = cohortData.is_provisional === true;
      
      // name and description are stored in dedicated DB columns; load from top-level fields
      if (cohortData.name) {
        this._cohort_data.name = cohortData.name;
      }
      if (cohortData.description !== undefined) {
        this._cohort_data.description = cohortData.description;
      }
      
      // Ensure phenotypes array exists before checking length
      if (!this._cohort_data.phenotypes) {
        this._cohort_data.phenotypes = [];
      }
      
      const hadNoPhenotypes = this._cohort_data.phenotypes.length === 0;
      this.createEmptyCohortDefaultPhenotypes();

      // IMPORTANT: Ensure study_id is in _cohort_data for backend saves
      if (!this._cohort_data.study_id && cohortData.study_id) {
        this._cohort_data.study_id = cohortData.study_id;
      }
      
      this.issues_service.validateCohort();
      this.ensureEffectiveTypes(); // Ensure all phenotypes have effective_type
      this.sortPhenotypes();
      
      // Ensure cohort always has a name - fix legacy cohorts with empty names
      if (!this._cohort_data.name || this._cohort_data.name.trim() === '') {
        this._cohort_data.name = `Cohort ${this._cohort_data.id}`;
      }
      this._cohort_name = this._cohort_data.name;
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

      // If default phenotypes were just created, persist them to the backend so the AI
      // chat and other backend consumers see the same state as the frontend.
      if (hadNoPhenotypes && this._cohort_data.phenotypes.length > 0 && this._cohort_data.study_id) {
        this.saveChangesToCohort(false, false).catch((err: any) => {
          console.error('[CohortModel] Failed to persist default phenotypes to backend:', err);
        });
      }
  }

  public setDatabaseSettings(databaseConfig: any) {
    // database is now stored at the study level via StudyDataService.setDatabaseConfig().
    // This method is kept for backward compatibility but delegates to the study service.
    import('../../StudyViewer/StudyDataService').then(({ StudyDataService }) => {
      StudyDataService.getInstance().setDatabaseConfig(databaseConfig);
    });
  }

  public get database(): Record<string, any> | null {
    return this._database;
  }

  public async setCohortDatabaseConfig(config: Record<string, any> | null): Promise<void> {
    this._database = config;
    await updateCohortDatabaseConfig(this._cohort_data.study_id, this._cohort_data.id, config);
  }


  public createEmptyCohortDefaultPhenotypes = () => {
    if (this._cohort_data.phenotypes.length == 0){
      const entry = {
        id: createID(),
        name: 'Entry Criterion',
        description: '',
        type: 'entry',
        effective_type: 'entry',
        codelist: "missing",
        domain: "missing",
        hierarchical_index: CohortModel.ENTRY_INDEX_LABEL,
        class_name:'CodelistPhenotype',
        return_date: "first"
      }

      const i1 = {
        id: createID(),
        class_name: "AgePhenotype",
        codelist: "missing",
        domain: "PERSON",
        effective_type: "inclusion",
        hierarchical_index: "1",
        index: 1,
        level: 0,
        name: "Adult",
        type: "inclusion",
        value_filter: {
            class_name: "ValueFilter",
            column_name: "",
            max_value: null,
            min_value: {
                class_name: "Value",
                operator: ">=",
                value: 18,
            }
        }
      }

      const i2 = {
        id: createID(),
        class_name: "TimeRangePhenotype",
        codelist: "missing",
        domain: "OBSERVATION_PERIOD",
        type: "inclusion",
        effective_type: "inclusion",
        hierarchical_index: "2",
        index: 2,
        level: 0,
        name: "Data coverage",
        relative_time_range: [
          {
            anchor_phenotype: null,
            class_name: "RelativeTimeRangeFilter",
            max_days: null,
            min_days: {
              class_name: "Value",
              operator: ">=",
              value: 365,
            },
            useConstant: false,
            useIndexDate: true,
            when: "before",
          }
        ]
      }
      this._cohort_data.phenotypes = [
        entry, i1, i2
      ];
      // Keep structured keys for internal frontend use (execution service needs them)
      // but strip them out before sending to backend (see stripLegacyStructuredKeys)
      this._cohort_data.entry_criterion = entry;
      this._cohort_data.inclusions = [i1, i2];
    }

  }

  public setConstants(constants: any) {
    this._cohort_data.constants = constants;
    this.saveChangesToCohort(false, false);
  }

  public onCellValueChanged(event: any, selectedRows?: any[]) {
    /*
    Update phenotype data with new value from grid editor
    */
    const fieldEdited = event.colDef.field;
    const newValue = event.newValue;
    
    // Determine which rows to update
    const rowsToUpdate = this.determineRowsToUpdate(event, selectedRows);

    
    // Apply changes to all target rows
    const changedRows = this.applyFieldChangesToRows(fieldEdited, newValue, rowsToUpdate);
    
    // Handle special cases and save changes
    this.handlePostUpdateActions(fieldEdited, changedRows);
  }

  private determineRowsToUpdate(event: any, selectedRows?: any[]): any[] {
    const editedRowId = event.data.id;
    
    // If we have selected rows and the edited row is among them, update all selected rows
    if (selectedRows && selectedRows.length > 0) {
      const editedRowIsSelected = selectedRows.some(row => row.id === editedRowId);
      if (editedRowIsSelected) {
        return selectedRows;
      }
    }
    
    // Otherwise, just update the edited row
    return [event.data];
  }

  private applyFieldChangesToRows(fieldEdited: string, newValue: any, rowsToUpdate: any[]): any[] {
    const changedRows: any[] = [];
    
    rowsToUpdate.forEach(rowData => {
      const phenotype = this._cohort_data.phenotypes.find(
        (p: TableRow) => p.id === rowData.id
      );
      
      if (phenotype) {
        // Apply the field change
        phenotype[fieldEdited] = newValue;
        changedRows.push(phenotype);
        
        // Handle type field changes for effective_type
        if (fieldEdited === 'type') {
          phenotype.effective_type = newValue;
          
          // Update descendants for component phenotypes
          const descendants = this.getAllDescendants(phenotype.id);
          descendants.forEach(descendant => {
            if (descendant.type === 'component') {
              descendant.effective_type = newValue;
              changedRows.push(descendant);
            }
          });
        }
      }
    });
    
    return changedRows;
  }

  private handlePostUpdateActions(fieldEdited: string, _changedRows: any[]): void {
    // Determine if we need a grid refresh based on the field type
    const needsGridRefresh = ['description', 'class_name', 'type'].includes(fieldEdited) || _changedRows.length>1;
    
    // Save changes once after all updates
    this.saveChangesToCohort(true, needsGridRefresh);
  }

  public async saveChangesToCohort(changesToCohort: boolean = true, refreshGrid: boolean = true) {
    if (changesToCohort) {
      this.sortPhenotypes();
      // No longer split phenotypes by type - backend expects phenotypes array only
    }
    this._cohort_data.name = this._cohort_name;
    this._table_data = this.tableDataFromCohortData();
    
    if (this._cohort_data.study_id) {
      console.log(`Saving cohort '${this._cohort_name}' to backend...`);
    }
    
    this.notifyNameChangeListeners();
    this.issues_service.validateCohort();
    
    // Strip legacy structured keys before sending to backend
    const cohortForBackend = this.stripLegacyStructuredKeys(this._cohort_data);
    
    // Only send to backend if we have valid IDs, otherwise we get 422 errors
    if (this._cohort_data.study_id && this._cohort_data.id) {
      await updateCohort(this._cohort_data.study_id, this._cohort_data.id, cohortForBackend);
    } else {
      console.warn("Skipping backend save: Missing study_id or cohort_id", { 
        study_id: this._cohort_data.study_id, 
        cohort_id: this._cohort_data.id 
      });
    }

    // Always notify listeners so name/state consumers (breadcrumb, card header) stay in sync.
    // notifyDataChangeListeners is also called for PhenotypeDataService sync.
    this.notifyListeners();
    this.notifyDataChangeListeners();
    
    // Only refresh the grid data if the row/column content changed.
    if (refreshGrid) {
      console.log("REFRESHING GRID");
    }
  }

  private stripLegacyStructuredKeys(cohortData: Record<string, any>): Record<string, any> {
    /**
     * Strips legacy structured keys (entry_criterion, inclusions, etc.), database,
     * name, and description from cohort data before sending to backend. Frontend keeps these
     * keys internally but name/description are stored in dedicated DB columns and
     * database is stored at the study level.
     */
    const { entry_criterion, inclusions, exclusions, characteristics, outcomes, database, name, description, ...cleanedCohort } = cohortData;
    // Pass name and description back at the top level so the backend can store them in their columns
    return { ...cleanedCohort, name, description };
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
    
    // Recalculate hierarchical indices after sorting
    this.calculateHierarchicalIndices();
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
      
      // Set effective_type for component phenotypes based on root ancestor
      if (type === 'component') {
        const ancestors = this.getAllAncestors(newPhenotype);
        if (ancestors.length > 0) {
          // Find the root ancestor (first non-component type, or the last ancestor)
          const rootAncestor = ancestors.find(ancestor => ancestor.type !== 'component') || ancestors[ancestors.length - 1];
          newPhenotype.effective_type = rootAncestor.effective_type || rootAncestor.type;
        }
      }
    } 

    // Set effective_type for non-component phenotypes (they are their own effective type)
    if (type !== 'component') {
      newPhenotype.effective_type = type;
    } 

    this._setNewPhenotypeDefaultValues(newPhenotype);
    this._cohort_data.phenotypes.push(newPhenotype);
    this.saveChangesToCohort(true, true);
  }

  public _setNewPhenotypeDefaultValues(newPhenotype: any) {
    if (newPhenotype.type == 'inclusion' || newPhenotype.type == 'exclusion' || newPhenotype.type == 'baseline'){
      newPhenotype.return_date = "last";
      newPhenotype.relative_time_range = [this.proto_constants.f_baseline_period]

    } else if (newPhenotype.type == 'outcome'){
      newPhenotype.return_date = "first";
      newPhenotype.relative_time_range = [this.proto_constants.f_followup_period]
    }
  }

  public getPhenotypeById(id: string): TableRow | undefined {
    return this._cohort_data.phenotypes.find(
      (phenotype: TableRow) => phenotype.id === id
    );
  }

  private ensureEffectiveTypes(): void {
    // First pass: set effective_type for non-component phenotypes
    this._cohort_data.phenotypes.forEach((phenotype: TableRow) => {
      if (phenotype.type !== 'component') {
        phenotype.effective_type = phenotype.type;
      }
    });

    // Second pass: set effective_type for component phenotypes based on ancestors
    this._cohort_data.phenotypes.forEach((phenotype: TableRow) => {
      if (phenotype.type === 'component' && !phenotype.effective_type) {
        const ancestors = this.getAllAncestors(phenotype);
        if (ancestors.length > 0) {
          // Find the root ancestor (first non-component type, or the last ancestor)
          const rootAncestor = ancestors.find(ancestor => ancestor.type !== 'component') || ancestors[ancestors.length - 1];
          phenotype.effective_type = rootAncestor.effective_type || rootAncestor.type;
        } else {
          // Fallback if no ancestors
          phenotype.effective_type = 'component';
        }
      }
    });

    // Third pass: calculate hierarchical indices for all phenotypes
    this.calculateHierarchicalIndices();
  }

  // Label used for entry criterion phenotypes (change here to affect all displays)
  private static readonly ENTRY_INDEX_LABEL = 'e';

  private calculateHierarchicalIndices(): void {
    // Entry: fixed label
    this._cohort_data.phenotypes
      .filter((p: any) => p.type === 'entry')
      .forEach((phenotype: any) => {
        phenotype.hierarchical_index = CohortModel.ENTRY_INDEX_LABEL;
        this.calculateComponentHierarchicalIndices(phenotype.id, CohortModel.ENTRY_INDEX_LABEL);
      });

    // Inclusion: own indexing starting at 1
    this._cohort_data.phenotypes
      .filter((p: any) => p.type === 'inclusion')
      .forEach((phenotype: any, index: number) => {
        const idx = (index + 1).toString();
        phenotype.hierarchical_index = idx;
        this.calculateComponentHierarchicalIndices(phenotype.id, idx);
      });

    // Exclusion: own indexing starting at 1
    this._cohort_data.phenotypes
      .filter((p: any) => p.type === 'exclusion')
      .forEach((phenotype: any, index: number) => {
        const idx = (index + 1).toString();
        phenotype.hierarchical_index = idx;
        this.calculateComponentHierarchicalIndices(phenotype.id, idx);
      });

    // Baseline: own indexing starting at 1
    this._cohort_data.phenotypes
      .filter((p: any) => p.type === 'baseline')
      .forEach((phenotype: any, index: number) => {
        const idx = (index + 1).toString();
        phenotype.hierarchical_index = idx;
        this.calculateComponentHierarchicalIndices(phenotype.id, idx);
      });

    // Outcome: own indexing starting at 1
    this._cohort_data.phenotypes
      .filter((p: any) => p.type === 'outcome')
      .forEach((phenotype: any, index: number) => {
        const idx = (index + 1).toString();
        phenotype.hierarchical_index = idx;
        this.calculateComponentHierarchicalIndices(phenotype.id, idx);
      });

    // Recalculate each phenotype's level from its current position in the
    // hierarchy. Level drives display styling (e.g. font size / indentation),
    // and can go stale when phenotypes are re-parented via drag & drop.
    this._cohort_data.phenotypes.forEach((phenotype: TableRow) => {
      phenotype.level = this.getAllAncestors(phenotype).length;
    });
  }

  private calculateComponentHierarchicalIndices(parentId: string, parentHierarchicalIndex: string): void {
    // Find direct component children of this parent
    const directChildren = this._cohort_data.phenotypes.filter(
      (phenotype: TableRow) =>
        phenotype.type === 'component' &&
        phenotype.parentIds && 
        Array.isArray(phenotype.parentIds) && 
        phenotype.parentIds.includes(parentId)
    );

    // Sort by their current index to maintain order
    directChildren.sort((a: any, b: any) => (a.index || 0) - (b.index || 0));

    // Assign hierarchical indices to direct children
    directChildren.forEach((child: any, index: number) => {
      const childIndex = index + 1; // 1-based indexing
      child.hierarchical_index = `${parentHierarchicalIndex}.${childIndex}`;
      
      // Recursively calculate for grandchildren
      this.calculateComponentHierarchicalIndices(child.id, child.hierarchical_index);
    });
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

  // Reorder component phenotypes within a specific parent
  public async updateComponentOrder(parentId: string, reorderedComponents: TableRow[]) {

    const allPhenotypes = [...this._cohort_data.phenotypes];
    const reorderedIds = new Set(reorderedComponents.map(c => c.id));
    
    // Strip UI-specific properties from reordered components before saving to cohort data
    const cleanedComponents = reorderedComponents.map(comp => {
      const { colorCellBackground, ...cleanComp } = comp as any;
      return cleanComp as TableRow;
    });
    
    // Build new phenotype array with reordered components in their new positions
    const newOrder: TableRow[] = [];
    
    for (const phenotype of allPhenotypes) {
      // If this is not one of the reordered components, add it normally
      if (!reorderedIds.has(phenotype.id)) {
        newOrder.push(phenotype);
        
        // If this is the parent, add the cleaned reordered children after it
        if (phenotype.id === parentId) {
          newOrder.push(...cleanedComponents);
        }
      }
    }
    
    // Update cohort data
    this._cohort_data.phenotypes = newOrder;
    // No longer split phenotypes by type - backend expects phenotypes array only
    this._cohort_data.name = this._cohort_name;
    
    // Recalculate hierarchical indices after reordering
    this.calculateHierarchicalIndices();
    
    // Update table data AFTER calculating hierarchical indices so they're reflected in the grid
    this._table_data = this.tableDataFromCohortData();
    
    await updateCohort(this._cohort_data.study_id, this._cohort_data.id, this._cohort_data);
    this.notifyNameChangeListeners();
    this.issues_service.validateCohort();
    
    // Notify both data change listeners (for cross-service sync) and grid refresh listeners
    this.notifyDataChangeListeners();
    this.notifyListeners();
  }

  public async updateRowOrder(newRowData: TableRow[]) {

    // Get all phenotypes (including those not currently visible due to filter)
    const allPhenotypes = [...this._cohort_data.phenotypes];

    // Check if we're actually reordering component phenotypes
    // If all dragged items are components with the same parent, use hierarchical reordering
    // Otherwise, use flat reordering to preserve drag order
    const isComponentReorder = newRowData.length > 0 && 
      newRowData.every(row => row.type === 'component');
    
    if (isComponentReorder) {
      await this.updateHierarchicalRowOrder(newRowData, allPhenotypes);
    } else {
      // Use flat reordering to preserve drag order for non-component phenotypes
      await this.updateFlatRowOrder(newRowData, allPhenotypes);
    }
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

    // Create a map of visible phenotype IDs for quick lookup
    const visiblePhenotypeIds = new Set(newRowData.map(row => row.id));

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

    // Rebuild the complete phenotypes array maintaining order within each type
    const order = ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome', 'component', 'NA'];
    let newCompleteOrder: TableRow[] = [];

    for (const type of order) {
      // Combine reordered visible phenotypes with hidden phenotypes for this type
      const visibleOfType = reorderedVisibleByType[type] || [];
      const hiddenOfType = hiddenPhenotypesByType[type] || [];
      const allOfType = [...visibleOfType, ...hiddenOfType];

      // Update indices within each type
      allOfType.forEach((phenotype, index) => {
        phenotype.index = index + 1;
      });

      newCompleteOrder = newCompleteOrder.concat(allOfType);
    }

    // Update the cohort data with the complete new order
    this._cohort_data.phenotypes = newCompleteOrder;

    // Don't call sortPhenotypes() during drag operations as it will mess up our ordering
    // No longer split phenotypes by type - backend expects phenotypes array only
    this._cohort_data.name = this._cohort_name;
    
    // Recalculate hierarchical indices after reordering
    this.calculateHierarchicalIndices();
    
    // Update table data AFTER calculating hierarchical indices so they're reflected in the grid
    this._table_data = this.tableDataFromCohortData();
    
    await updateCohort(this._cohort_data.study_id, this._cohort_data.id, this._cohort_data);
    this.notifyNameChangeListeners();
    this.issues_service.validateCohort();
    
    // Notify both data change listeners (for cross-service sync) and grid refresh listeners
    this.notifyDataChangeListeners();
    this.notifyListeners();
  }

  private async updateHierarchicalRowOrder(newRowData: TableRow[], allPhenotypes: TableRow[]) {
    
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
    
    // Update the cohort data
    this._cohort_data.phenotypes = newCompleteOrder;
    
    // No longer split phenotypes by type - backend expects phenotypes array only
    this._cohort_data.name = this._cohort_name;
    
    // Recalculate hierarchical indices (and levels) before building table data
    // so the grid reflects any re-parenting from the drag operation.
    this.calculateHierarchicalIndices();
    this._table_data = this.tableDataFromCohortData();
    
    await updateCohort(this._cohort_data.study_id, this._cohort_data.id, this._cohort_data);
    this.notifyNameChangeListeners();
    this.issues_service.validateCohort();
    
    // Notify both data change listeners (for cross-service sync) and grid refresh listeners
    this.notifyDataChangeListeners();
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

  /**
   * Move a phenotype into a different section (its `type`). The phenotype
   * becomes a top-level phenotype of `newType`, and any component descendants
   * follow it and inherit the new effective_type. `newRowData` is the grid's
   * visible row order, used to position the moved phenotype within the
   * destination section.
   */
  public async movePhenotypeToSection(draggedId: string, newType: string, newRowData: TableRow[]) {
    const dragged = this.getPhenotypeById(draggedId);
    if (!dragged || dragged.type === newType) {
      // Same section: a plain reorder is sufficient.
      await this.updateRowOrder(newRowData);
      return;
    }

    // The entry section holds exactly one criterion; never create a second one.
    if (newType === 'entry' && this._cohort_data.phenotypes.some(
      (p: TableRow) => p.type === 'entry' && p.id !== draggedId
    )) {
      return;
    }

    // Component descendants inherit the destination section's effective_type.
    const descendantIds = new Set(this.getAllDescendants(draggedId).map(d => d.id));
    this._cohort_data.phenotypes.forEach((p: TableRow) => {
      if (p.type === 'component' && descendantIds.has(p.id)) {
        p.effective_type = newType;
      }
    });

    // Mirror the section change onto the incoming rows so the flat reorder groups
    // the moved phenotype (and any visible descendants) into the destination.
    newRowData.forEach(row => {
      if (row.id === draggedId) {
        row.type = newType;
        row.effective_type = newType;
        row.parentIds = [];
      } else if (descendantIds.has(row.id)) {
        row.effective_type = newType;
      }
    });

    await this.updateFlatRowOrder(newRowData, [...this._cohort_data.phenotypes]);
  }

  /**
   * Convert a phenotype into a component of `targetParentId`, detaching it from
   * any previous parent. Its descendants follow and inherit the parent's
   * effective_type. The moved subtree is placed immediately after the target's
   * existing subtree.
   */
  public async makePhenotypeComponentOf(draggedId: string, targetParentId: string) {
    const dragged = this.getPhenotypeById(draggedId);
    const target = this.getPhenotypeById(targetParentId);
    if (!dragged || !target || draggedId === targetParentId) return;

    // Guard against cycles: a phenotype cannot become a component of its own descendant.
    if (this.getAllDescendants(draggedId).some(d => d.id === targetParentId)) return;

    const newEffectiveType = target.effective_type || target.type;

    // Capture the moved subtree (dragged first, then its descendants) in order,
    // before re-parenting changes the ancestry lookups.
    const subtree = [dragged, ...this.getAllDescendants(draggedId)];
    const subtreeIds = new Set(subtree.map(p => p.id));

    // Re-parent the dragged phenotype and propagate the new effective_type.
    dragged.type = 'component';
    dragged.parentIds = [targetParentId];
    subtree.forEach(p => { p.effective_type = newEffectiveType; });

    // Append the dragged phenotype as the last component of the target.
    const existingChildCount = this._cohort_data.phenotypes.filter(
      (p: TableRow) => p.type === 'component' && p.parentIds?.includes(targetParentId)
    ).length;
    dragged.index = existingChildCount + 1;

    // Relocate the subtree to just after the target's existing subtree, keeping
    // every other phenotype in place.
    const remaining = this._cohort_data.phenotypes.filter((p: TableRow) => !subtreeIds.has(p.id));
    const targetSubtreeIds = new Set([
      targetParentId,
      ...this.getAllDescendants(targetParentId)
        .filter(d => !subtreeIds.has(d.id))
        .map(d => d.id),
    ]);
    let insertAt = remaining.length;
    for (let i = 0; i < remaining.length; i++) {
      if (targetSubtreeIds.has(remaining[i].id)) insertAt = i + 1;
    }
    remaining.splice(insertAt, 0, ...subtree);
    this._cohort_data.phenotypes = remaining;

    this._cohort_data.name = this._cohort_name;
    this.calculateHierarchicalIndices();
    this._table_data = this.tableDataFromCohortData();

    await updateCohort(this._cohort_data.study_id, this._cohort_data.id, this._cohort_data);
    this.notifyNameChangeListeners();
    this.issues_service.validateCohort();
    this.notifyDataChangeListeners();
    this.notifyListeners();
  }

  /**
   * Whether `draggedId` may be made a component of `targetId`. Prevents
   * self-drops and cycles (dropping onto one's own descendant).
   */
  public canMakePhenotypeComponentOf(draggedId: string, targetId: string): boolean {
    if (!draggedId || !targetId || draggedId === targetId) return false;
    const target = this.getPhenotypeById(targetId);
    const dragged = this.getPhenotypeById(draggedId);
    if (!target || !dragged) return false;
    // A phenotype cannot become a component of its own descendant.
    if (this.getAllDescendants(draggedId).some(d => d.id === targetId)) return false;
    // Already a direct component of this target — nothing to do.
    if (dragged.type === 'component' && dragged.parentIds?.[0] === targetId) return false;
    return true;
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

  public async createNewCohort(studyId?: string) {
    /*
    Creates a new cohort and immediately saves it to the database.
    All subsequent saves will use updateCohort since the cohort already exists.
    */
    const cohortId = createID();
    this._cohort_data = {
      id: cohortId,
      name: 'Name your cohort...',
      class_name: 'Cohort',
      study_id: studyId,
      phenotypes: [],
      database: {},
      constants: [],
    };
    this._cohort_name = this._cohort_data.name;
    this._table_data = this.tableDataFromCohortData();
    this.constants_service.refreshConstants();
    this.isNewCohort = true;
    
    // Immediately save to database if we have a study_id
    if (studyId) {
      try {
        await createCohort(studyId, cohortId, this._cohort_data);
        console.log(`✅ Created new cohort ${cohortId} in database`);
      } catch (error) {
        console.error('Failed to create cohort in database:', error);
        throw error;
      }
    }
    
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

  // Data change listeners - called on every data change (for syncing with other services)
  private dataChangeListeners: Array<() => void> = [];

  public addDataChangeListener(listener: () => void) {
    this.dataChangeListeners.push(listener);
  }

  public removeDataChangeListener(listener: () => void) {
    const index = this.dataChangeListeners.indexOf(listener);
    if (index > -1) {
      this.dataChangeListeners.splice(index, 1);
    }
  }

  private notifyDataChangeListeners() {
    console.log("Notifying data change listeners", this.dataChangeListeners);
    this.dataChangeListeners.forEach(listener => listener());
  }

  private nameChangeListeners: Array<() => void> = [];

  // Execution progress listener management - delegate to execution service
  public addExecutionProgressListener(
    listener: (message: string | any, type: 'log' | 'error' | 'result' | 'complete') => void
  ) {
    this.execution_service.addExecutionProgressListener(listener);
  }

  public removeExecutionProgressListener(
    listener: (message: string | any, type: 'log' | 'error' | 'result' | 'complete') => void
  ) {
    this.execution_service.removeExecutionProgressListener(listener);
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

  /** Public trigger to broadcast the current cohort state to every listener set. */
  public notifyAllListeners() {
    this.notifyListeners();
    this.notifyNameChangeListeners();
    this.notifyDataChangeListeners();
  }

  public updateCohortFromChat(response: any) {
    // Response structure from backend:
    // { cohort_data: {...}, is_provisional: true/false, version: number, ... }
    
    // If response has cohort_data nested, extract it but preserve is_provisional
    if (response.cohort_data) {
      this._cohort_data = response.cohort_data;
      // Store the is_provisional flag at the top level of cohort_data for easy access
      // Use explicit === true to ensure false is properly handled (not truthy check)
      this._cohort_data.is_provisional = response.is_provisional === true;
      this._cohort_data.version = response.version;
    } else {
      // Fallback for responses that are already in cohort_data format
      this._cohort_data = response;
      // Ensure is_provisional is explicitly boolean
      if (this._cohort_data.is_provisional !== undefined) {
        this._cohort_data.is_provisional = this._cohort_data.is_provisional === true;
      }
    }
    console.log('Cohort data updated from chat response:', this._cohort_data);
    this.ensureEffectiveTypes(); // Ensure AI-generated phenotypes have effective_type for proper coloring
    this.sortPhenotypes();
    // No longer split phenotypes by type - backend expects phenotypes array only
    // this._cohort_data.name = this._cohort_name;
    this._table_data = this.tableDataFromCohortData();
    console.log('Cohort data updated from chat response: after setting table data', this._table_data);

    this.notifyListeners();
  }

  public async executeCohort(): Promise<void> {
    try {
      // Delegate to execution service
      const processedCohort = await this.execution_service.executeCohort(
        this._cohort_data,
        this._cohort_data.database
      );
      
      // Update cohort data with execution results
      this._cohort_data = processedCohort;
      
      // Sort phenotypes and save changes
      this.sortPhenotypes();
      this.saveChangesToCohort();
    } catch (error) {
      console.error('Error executing cohort:', error);
      throw error;
    }
  }

  async deleteCohort() {
    if (this._cohort_data.id) {
      await deleteCohort(this._cohort_data.study_id, this._cohort_data.id);
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

  public toggleComponentPhenotypes(show: boolean): void {
    this._showComponents = show;
    this._table_data = this.tableDataFromCohortData();
    this.notifyListeners(); // Refresh the grid
  }

  public getShowComponents(): boolean {
    return this._showComponents;
  }

  public setComponentLevel(level: number): void {
    this._componentLevel = level;
    this._table_data = this.tableDataFromCohortData();
    this.notifyListeners();
  }

  public getComponentLevel(): number {
    return this._componentLevel;
  }

  /**
   * Highest selectable level for the whole cohort, matching the level numbering
   * (level 0 = no children, level 1 = direct children, ...). Equals the deepest
   * component depth + 1, or 0 when there are no components.
   */
  public getMaxComponentLevel(): number {
    const components = (this._cohort_data.phenotypes || []).filter(
      (p: TableRow) => p.type === 'component'
    );
    let max = 0;
    for (const component of components) {
      max = Math.max(max, this.getComponentDepth(component) + 1);
    }
    return max;
  }

  /**
   * Highest selectable level for the subtree under `parentId`, relative to that
   * phenotype (direct children = level 1). Returns 0 when the phenotype has no
   * component children.
   */
  public getMaxComponentLevelForPhenotype(parentId: string): number {
    const components = (this._cohort_data.phenotypes || []).filter(
      (p: TableRow) => p.type === 'component'
    );
    const subtreeDepth = (id: string, level: number): number => {
      const children = components.filter(
        (c: TableRow) => Array.isArray(c.parentIds) && c.parentIds.includes(id)
      );
      if (children.length === 0) return level;
      return Math.max(...children.map(child => subtreeDepth(child.id, level + 1)));
    };
    return subtreeDepth(parentId, 0);
  }

  /**
   * Depth of a component within the component hierarchy. A component whose
   * parent is a top-level (non-component) phenotype has depth 0; each nested
   * component generation increments the depth by one.
   */
  private getComponentDepth(component: TableRow): number {
    let depth = 0;
    let current: any = component;
    const seen = new Set<string>();
    while (current) {
      const parentId = Array.isArray(current.parentIds) ? current.parentIds[0] : undefined;
      if (!parentId || seen.has(parentId)) break;
      seen.add(parentId);
      const parent = (this._cohort_data.phenotypes || []).find((p: any) => p.id === parentId);
      if (!parent || parent.type !== 'component') break;
      depth += 1;
      current = parent;
    }
    return depth;
  }

  public toggleShowFullCodelists(show: boolean): void {
    this._showFullCodelists = show;
    this._table_data = this.tableDataFromCohortData();
    this.notifyListeners();
  }

  public getShowFullCodelists(): boolean {
    return this._showFullCodelists;
  }

  public updateColumns(newColumns: ColumnDefinition[]): void {
    this.columns = newColumns;
    this._table_data = this.tableDataFromCohortData();
    this.notifyListeners();
  }

  public tableDataForComponentPhenotype(
    parentPhenotype: any,
    showChildren: boolean = true,
    maxLevel: number = Number.POSITIVE_INFINITY
  ): TableData {
    if (!parentPhenotype || !showChildren) {
      return { rows: [], columns: componentPhenotypeColumns };
    }

    const allComponents = (this._cohort_data.phenotypes || []).filter(
      (phenotype: TableRow) => phenotype.type === 'component'
    );

    const descendants = this.getComponentDescendantsUpToLevel(
      parentPhenotype.id,
      allComponents,
      maxLevel
    );

    // Add colorCellBackground property to hide background colors
    const phenotypesWithColorSettings = descendants.map((phenotype: any) => ({
      ...phenotype,
      colorCellBackground: false,
    }));

    return {
      rows: phenotypesWithColorSettings,
      columns: componentPhenotypeColumns,
    };
  }

  /**
   * Hierarchically ordered descendants of `parentId` limited by depth.
   * `maxLevel` 0 returns nothing, 1 returns direct children, 2 adds
   * grandchildren, etc. Pass `Infinity` to return the full subtree.
   */
  private getComponentDescendantsUpToLevel(
    parentId: string,
    components: TableRow[],
    maxLevel: number,
    currentLevel: number = 1
  ): TableRow[] {
    if (currentLevel > maxLevel) {
      return [];
    }

    const result: TableRow[] = [];

    const directChildren = components.filter(
      (phenotype: TableRow) =>
        Array.isArray(phenotype.parentIds) && phenotype.parentIds.includes(parentId)
    );
    directChildren.sort((a, b) => (a.index || 0) - (b.index || 0));

    for (const child of directChildren) {
      result.push(child);
      result.push(
        ...this.getComponentDescendantsUpToLevel(child.id, components, maxLevel, currentLevel + 1)
      );
    }

    return result;
  }
}
