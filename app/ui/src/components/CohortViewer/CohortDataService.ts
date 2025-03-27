import { TableData, ColumnDefinition, TableRow } from './tableTypes';
import { PhenexDirectoryParserService } from '../../services/PhenexDirectoryParserService';
import { DirectoryReaderWriterService } from '../LeftPanel/DirectoryReaderWriterService';
import { executeStudy } from '../../api/execute_cohort/route';
import { MapperDomains } from '../../types/mappers';
import { getCohort, updateCohort, deleteCohort } from '../../api/text_to_cohort/route';

// export abstract class CohortDataService {
export class CohortDataService {
  private static instance: CohortDataService;
  private _cohort_name: string = '';
  private _cohort_data: Record<string, any> = {};
  private _table_data: TableData = {
    rows: [],
    columns: [],
  };
  private _parser = PhenexDirectoryParserService.getInstance();

  private columns: ColumnDefinition[] = [
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      pinned: 'left',
      editable: true,
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 80,
      pinned: 'left',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'],
      },
    },
    {
      field: 'count',
      headerName: 'N',
      width: 80,
      editable: false,
      wrapText: false,
      pinned: 'left',
    },
    {
      field: 'description',
      headerName: 'Description',
      width: 250,
      editable: true,
      cellEditor: 'agLargeTextCellEditor',
      cellEditorPopup: true,
      wrapText: true,
      cellEditorParams: {
        maxLength: 2000,
      },
    },
    {
      field: 'class_name',
      headerName: 'Phenotype',
      width: 200,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: [
          'CodelistPhenotype',
          'MeasurementPhenotype',
          'ContinuousCoveragePhenotype',
          'AgePhenotype',
          'DeathPhenotype',
          'LogicPhenotype',
          'ScorePhenotype',
          'ArithmeticPhenotype',
        ],
      },
    },
    {
      field: 'domain',
      headerName: 'Domain',
      width: 120,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: [
          'CONDITION_OCCURRENCE_SOURCE',
          'CONDITION_OCCURRENCE',
          'Drug Exposure',
          'Procedure Occurrence',
          'Person',
          'Observation',
        ],
      },
    },
    {
      field: 'codelist',
      headerName: 'Codelists',
      width: 200,
      editable: true,
      cellEditor: 'CodelistCellEditor',
      cellEditorPopup: true,
    },
    {
      field: 'categorical_filter',
      headerName: 'Categorical filters',
      width: 200,
      editable: true,
      cellEditor: 'CategoricalFilterCellEditor',
      cellEditorPopup: true,
    },
    {
      field: 'relative_time_range',
      headerName: 'Relative time ranges',
      width: 200,
      editable: true,
      cellEditor: 'RelativeTimeRangeFilterCellEditor',
      cellEditorPopup: true,
      cellEditorParams: {
        maxLength: 2000,
      },
    },
    { field: 'date_range', headerName: 'Date range', width: 200, editable: true },
    { field: 'value', headerName: 'Value', width: 150, editable: true },
  ];

  private constructor() {}

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
    console.log('setting cohort name IN DATRA SERVICE', value);
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

  private _currentFilter: string[] = [];
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
    console.log('LOADING COHORT DATA', cohortIdentifiers);
    try {
      const cohortResponse = await getCohort(cohortIdentifiers.id);
      this._cohort_data = cohortResponse;
      this._cohort_name = this._cohort_data.name || 'Unnamed Cohort';
      if (!this._cohort_data.id) {
        this._cohort_data.id = this.createId();
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
      domainColumn.cellEditorParams.values = MapperDomains[databaseConfig.mapper];
    }

    // Refresh table data to reflect the updated domain values
    this.saveChangesToCohort();
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
    this.saveChangesToCohort();
  }

  public async saveChangesToCohort(changesToCohort: boolean = true) {
    if (changesToCohort) {
      this.sortPhenotypes();
      this.splitPhenotypesByType();
    }
    this._cohort_data.name = this._cohort_name;
    await updateCohort(this._cohort_data.id, this._cohort_data);
    this._table_data = this.tableDataFromCohortData();
    this.notifyListeners();
  }

  private sortPhenotypes() {
    /*
    Sort phenotypes by type. # TODO sort phenotypes by index in type
    */
    const order = ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome', 'NA'];

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

  public addPhenotype(type: string = 'NA') {
    const newPhenotype: TableRow = {
      id: this.createId(),
      type: type,
      name: 'New phenotype',
      class_name: 'CodelistPhenotype',
    };
    this._cohort_data.phenotypes.push(newPhenotype);
    this.sortPhenotypes();
    this.saveChangesToCohort();
    console.log('addPhenotype cohort data!!! ', this._cohort_data);
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
  private createId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private isNewCohort(): boolean {
    return this._cohort_data.id.startsWith('Cohort_NEW');
  }

  public async createNewCohort() {
    /*
    Creates an in memory cohort (empty) data structure new cohort. This is not saved to disk! only when user inputs any changes to the cohort are changes made
    */
    this._cohort_data = {
      id: this.createId(),
      name: 'NEW cohort',
      class_name: 'Cohort',
      phenotypes: [
        {
          id: this.createId(),
          type: 'entry',
          name: 'Entry criterion',
          class_name: 'CodelistPhenotype',
        },
      ],
      database_config: {},
    };
    this._cohort_name = this._cohort_data.name;
    this._table_data = this.tableDataFromCohortData();
    this.notifyListeners(); // Notify listeners after initialization
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

  public updateCohortFromChat(newCohort) {
    this._cohort_data = newCohort;
    console.log('UPDATED COHROT DATA', newCohort);
    this.saveChangesToCohort();
  }

  public async executeCohort(): Promise<void> {
    try {
      const response = await executeStudy({
        cohort: this._cohort_data,
        database_config: this._cohort_data.database_config,
      });
      console.log('GOT RESPONSE', response);
      this._cohort_data = response.cohort;
      this.preparePhenexCohortForUI();
      this.saveChangesToCohort();
    } catch (error) {
      console.error('Error fetching cohort explanation:', error);
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

  public createPhenotypesArrayFromTypes() {
    this._cohort_data.phenotypes = this._cohort_data.e;
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
}
