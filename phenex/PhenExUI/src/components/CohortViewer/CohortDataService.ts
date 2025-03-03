import { TableData, ColumnDefinition, TableRow } from './tableTypes';
import { PhenexDirectoryParserService } from '../../services/PhenexDirectoryParserService';
import { DirectoryReaderWriterService } from '../LeftPanel/DirectoryReaderWriterService';

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
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      pinned: 'left',
      editable: true,
      cellRenderer: 'NameCellRenderer',
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
          'Condition Occurrence',
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
    { field: 'categorical_filter', headerName: 'Categorical filters', width: 200, editable: true },
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

  public tableDataFromCohortData(): TableData {
    return {
      rows: this._cohort_data.phenotypes,
      columns: this.columns,
    };
  }

  public async loadCohortData(cohortName: string): Promise<void> {
    this._cohort_name = cohortName;
    this._cohort_data = await this._parser.fetchCohortData(cohortName);
    if (!this._cohort_data.id) {
      this._cohort_data.id = this.createId();
    }
    this._table_data = this.tableDataFromCohortData();
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

  public saveChangesToCohort() {
    this.sortPhenotypes();
    this.splitPhenotypesByType();
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
      phenotypes: [],
    };
    this._cohort_name = this._cohort_data.name;
    this._table_data = this.tableDataFromCohortData();
  }
}
