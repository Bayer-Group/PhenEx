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
    { field: 'codelists', headerName: 'Codelists', width: 200, editable: true },
    { field: 'categorical_filter', headerName: 'Categorical filters', width: 200, editable: true },
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
    const rowIdEdited = event.data.id;
    let phenotypeEdited = this._cohort_data.phenotypes.find(
      (row: TableRow) => row.id === rowIdEdited
    );
    phenotypeEdited[fieldEdited] = event.newValue;
    console.log("EDITED THIS ON", phenotypeEdited)
    this.saveChangesToCohort();
  }

  public saveChangesToCohort() {
    this.sortPhenotypes();
    this.splitPhenotypesByType()
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
    console.log("AFTER SORTING", this._cohort_data)
    this._table_data= this.tableDataFromCohortData()
    console.log("AFTER SORTING", this._table_data)
  }

  private splitPhenotypesByType() {
    const types = ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'];
    const type_keys = ['entry_criterion', 'inclusions', 'exclusions', 'characteristics', 'outcomes'];

    // iterate over order, finding phenotypes of that type and appending to a new array of phenotypes
    let i = 0;
    for (const type of types) {
      const phenotypesOfType = this._cohort_data.phenotypes.filter(
        (row: TableRow) => row.type === type
      );
      if (type == 'entry'){
        this._cohort_data.entry_criterion = phenotypesOfType[0];
      }
      else{
        const type_key = type_keys[i]
        this._cohort_data[type_key] = phenotypesOfType;
      }
      i++;
    }
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
    const id_ = this._cohort_data.id
    this._cohort_data = {
      id: id_,
      name: 'Cohort_'+id_,
      class_name: 'Cohort',
      phenotypes: [],
    };

    this._cohort_name = id_
    this._table_data = {
      rows: [],
      columns: this.columns,
    };
  }
}
