import { TableData, ColumnDefinition, TableRow } from '../tableTypes';
import { executeStudy } from '../../../api/execute_cohort/route';
import { getCohort, updateCohort, deleteCohort } from '../../../api/text_to_cohort/route';
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
    console.log('setting cohort name IN DATRA SERVICE', value, this.cohort_data.name);
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
      const cohortResponse = await getCohort(cohortIdentifiers.id);
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
      this.notifyListeners(); // Notify listeners after loading data
      console.log(this._table_data);
    } catch (error) {
      console.error('Error loading cohort data:', error);
    }
  }

  public setDatabaseSettings(databaseConfig) {
    this._cohort_data.database_config = databaseConfig;
    console.log(databaseConfig);

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
    console.log(constants);
    this.saveChangesToCohort(false, false);
  }

  public onCellValueChanged(event: any) {
    /*
    Update phenotype data with new value from grid editor
    */
    const fieldEdited = event.colDef.field;
    const rowIdEdited = event.data.id; // TODO consider giving all phenotypes an ID
    console.log('onCellValueChanged', fieldEdited, rowIdEdited);
    let phenotypeEdited = this._cohort_data.phenotypes.find(
      (row: TableRow) => row.id === rowIdEdited
    );
    phenotypeEdited[fieldEdited] = event.newValue;
    console.log('onCellValueChanged', phenotypeEdited);
    this.saveChangesToCohort(true, false);
  }

  public async saveChangesToCohort(changesToCohort: boolean = true, refreshGrid: boolean = true) {
    console.log('SAHVE  COHORT', changesToCohort, refreshGrid);
    if (changesToCohort) {
      this.sortPhenotypes();
      this.splitPhenotypesByType();
    }

    console.log('COHORT NAME', this._cohort_name, this._cohort_data.name);
    if (this._cohort_data.name != this._cohort_name) {
      this.notifyNameChangeListeners();
    }
    this._cohort_data.name = this._cohort_name;
    this._table_data = this.tableDataFromCohortData();
    await updateCohort(this._cohort_data.id, this._cohort_data);
    console.log('ABOUT TO UPDATE issues_service');
    this.issues_service.validateCohort();
    console.log('SAVED CohorT NOW', this._cohort_data);
    if (refreshGrid) {
      console.log('And table data...', this._table_data);
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
      const phenotypesOfType = this._cohort_data.phenotypes.filter(
        (row: TableRow) => row.type === type
      );
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
    console.log('addPhenotype cohort data!!! ', type, parentPhenotypeId, this._cohort_data);
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
      phenotypes: [
      ],
      database_config: {},
    };
    this._cohort_name = this._cohort_data.name;
    this._table_data = this.tableDataFromCohortData();
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
    console.log('DAT ASERVIC IS NOTIFYIN');
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
    console.log('UPDATED COHROT DATA', newCohort);
    this.sortPhenotypes();
    this.splitPhenotypesByType();
    // this._cohort_data.name = this._cohort_name;
    this._table_data = this.tableDataFromCohortData();
    console.log('UPDATED COHROT DATA', this._table_data);
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

      console.log('GOT RESPONSE', response);
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
    }
  }

  public filterType(type: string | string[]): void {
    this._currentFilter = Array.isArray(type) ? type : [type];
    this._table_data = this.tableDataFromCohortData();
    this.notifyListeners();
  }

  public tableDataForComponentPhenotype(parentPhenotype): TableData {
    let filteredPhenotypes = this._cohort_data.phenotypes || [];
    if (this._currentFilter.length > 0) {
      filteredPhenotypes = filteredPhenotypes.filter(
        (phenotype: TableRow) =>
          phenotype.type === 'component' && phenotype.parentIds.includes(parentPhenotype.id)
      );
    }
    return {
      rows: filteredPhenotypes,
      columns: this.columns,
    };
  }
}
