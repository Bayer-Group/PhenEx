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
    };
    if (parentPhenotypeId) {
      newPhenotype.parentIds = [parentPhenotypeId];
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

  public deletePhenotype(id: string) {
    const phenotypeIndex = this._cohort_data.phenotypes.findIndex(
      (phenotype: TableRow) => phenotype.id === id
    );
    if (phenotypeIndex !== -1) {
      this._cohort_data.phenotypes.splice(phenotypeIndex, 1);
      this.saveChangesToCohort();
      return {
        remove: [id],
      };
    }
    return null;
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

    console.log('=== updateRowOrder END ===');

    // Don't call sortPhenotypes() during drag operations as it will mess up our ordering
    this.splitPhenotypesByType();
    this._cohort_data.name = this._cohort_name;
    await updateCohort(this._cohort_data.id, this._cohort_data);
    this.notifyNameChangeListeners();
    this.issues_service.validateCohort();
    this.notifyListeners();
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
