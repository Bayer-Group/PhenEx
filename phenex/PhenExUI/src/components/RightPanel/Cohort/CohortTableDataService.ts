import { TableData, ColumnDefinition, TableRow } from '../Tables/tableTypes';
import { PhenexDirectoryParserService } from '../../../services/PhenexDirectoryParserService';
import { DirectoryReaderWriterService } from '../../LeftPanel/DirectoryReaderWriterService';

// export abstract class CohortTableDataService {
export class CohortTableDataService {
  private static instance: CohortTableDataService;
  private _cohort_name: string = '';
  private _cohort_data: Record<string, any> = {};
  private _table_data: TableData = {
    rows: [],
    columns: [],
  };
  private _parser = PhenexDirectoryParserService.getInstance();

  private columns: ColumnDefinition[] = [
    {
      field: 'type',
      headerName: 'Type',
      width: 120,
      pinned: 'left',
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'],
      },
    },
    { field: 'name', headerName: 'Name', width: 250, pinned: 'left', editable: true },
    {
      field: 'description',
      headerName: 'Description',
      width: 500,
      editable: true,
      cellEditor: 'agLargeTextCellEditor',
      cellEditorPopup: true,
      wrapText: true,
      cellEditorParams: {
        maxLength: 1000,
      },
    },
    {
      field: 'phenotype',
      headerName: 'Phenotype',
      width: 200,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['Codelist', 'Measurement', 'ContinuousCoverage', 'Age', 'Death', 'Logic'],
      },
    },
    { field: 'codelists', headerName: 'Codelists', width: 200, editable: true },
    { field: 'categorical_filters', headerName: 'Categorical filters', width: 200, editable: true },
    {
      field: 'relative_time_range',
      headerName: 'Relative time ranges',
      width: 200,
      editable: true,
    },
    { field: 'date_range', headerName: 'Date range', width: 200, editable: true },
    { field: 'value', headerName: 'Value', width: 150, editable: true },
  ];

  private constructor() {}

  public static getInstance(): CohortTableDataService {
    if (!CohortTableDataService.instance) {
      CohortTableDataService.instance = new CohortTableDataService();
    }
    return CohortTableDataService.instance;
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

  public tableDataFromCohortData(): TableData {
    return {
      rows: this._cohort_data.phenotypes,
      columns: this.columns,
    };
  }

  public async loadCohortData(cohortName: string): Promise<void> {
    this._cohort_name = cohortName;
    this._cohort_data = await this._parser.fetchCohortData(cohortName);
    this._table_data = this.tableDataFromCohortData();
  }

  public async fetchTableData(): Promise<TableData> {
    // check if cohort_data is already defined
    if (Object.keys(this._cohort_data).length === 0) {
      this._cohort_data = await this._parser.fetchCohortData(this._cohort_name);
    }
    return this.tableDataFromCohortData();
  }

  public onCellValueChanged(event: any) {
    /*
    Update phenotype data with new value from grid editor
    */
    const fieldEdited = event.colDef.field;
    const rowIdEdited = event.data.id;
    let phenotypeEdited = this._cohort_data.phenotypes.find(
      (row: TableRow) => row.id === rowIdEdited
    );
    phenotypeEdited[fieldEdited] = event.newValue;
    this.saveChangesToCohort();
  }

  public saveChangesToCohort() {
    this.sortPhenotypes();
    const writer = DirectoryReaderWriterService.getInstance();
    this._cohort_data.name = this._cohort_name;
    writer.writeFile('cohort_' + this._cohort_data.id + '.json', JSON.stringify(this._cohort_data));
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
  }

  public addPhenotype() {
    const newPhenotype: TableRow = {
      id: this._cohort_data.phenotypes.length + 1,
      type: 'NA',
      name: 'New phenotype',
      phenotype: 'Codelist',
      codelists: '',
      categorical_filters: '',
      relative_time_range: '',
      date_range: '',
      value: '',
    };
    this._cohort_data.phenotypes.push(newPhenotype);
    return {
      add: [newPhenotype],
      addIndex: this._cohort_data.phenotypes.length - 1,
    };
  }

  private createId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  public createNewCohort() {
    // TODO check that no phenotype named new cohort exists in directory
    this._cohort_data = {
      id: this.createId(),
      name: 'New Cohort',
      type: 'cohort',
      phenotypes: [],
    };
  }
}
