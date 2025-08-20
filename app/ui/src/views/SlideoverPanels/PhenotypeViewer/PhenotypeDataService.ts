import { themeQuartz } from 'ag-grid-community';
import classDefinitions from '../../../assets/class_definitions.json';
import { defaultColumns } from './PhenotypeColumnDefinitions';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
export interface Phenotype {
  name: string;
  description?: string;
  id?: string;
  class_name?: string;
  type?: string;
  [key: string]: any;
}

export interface ParamRow {
  parameter: string;
  value: string;
}

export class PhenotypeDataService {
  private static instance: PhenotypeDataService;
  public currentPhenotype: Phenotype | null = null;
  public rowData: ParamRow[] = [
    { parameter: 'class_name', value: 'No phenotype selected' },
    { parameter: 'Type', value: 'Not set' },
    { parameter: 'Description', value: 'Not set' },
  ];

  public componentPhenotypeTableData: TableData = {
    rows: [],
    columns: [],
  };

  private listeners: ((refreshGrid: boolean) => void)[] = [];
  private componentPhenotypeListeners: ((refreshGrid: boolean) => void)[] = [];
  private cohortDataService = CohortDataService.getInstance(); // Assuming CohortDataService is a singleton class

  private constructor() {}

  public static getInstance(): PhenotypeDataService {
    if (!PhenotypeDataService.instance) {
      PhenotypeDataService.instance = new PhenotypeDataService();
    }
    return PhenotypeDataService.instance;
  }

  public getColumnDefs() {
    return defaultColumns;
  }

  public getTheme() {
    return themeQuartz.withParams({
      accentColor: '#DDDDDD',
      borderColor: 'var(--line-color-grid)',
      browserColorScheme: 'light',
      columnBorder: true,
      headerFontSize: 14,
      headerFontWeight: 'bold',
      headerRowBorder: true,
      cellHorizontalPadding: 10,
      headerBackgroundColor: 'var(--background-color)',
      backgroundColor: 'var(--background-color)',
      rowBorder: true,
      spacing: 8,
      wrapperBorder: false,
    });
  }

  public setData(data: Phenotype | undefined) {
    console.log('SETTING DATA');
    this.currentPhenotype = data || null;
    this.updateRowData();
    this.updateComponentPhenotypeData();
    this.notifyListeners(true);
  }

  public getData(): Phenotype | null {
    return this.currentPhenotype;
  }

  public getRowData(): ParamRow[] {
    return this.rowData;
  }

  public valueChanged(rowData: ParamRow, newValue: any) {
    if (this.currentPhenotype) {
      this.currentPhenotype[rowData.parameter] = newValue;
      this.saveChangesToPhenotype();
    }
  }

  public saveChangesToPhenotype() {
    if (this.currentPhenotype) {
      this.notifyListeners(false);
      this.cohortDataService.saveChangesToCohort(false, true);
    }
  }

  private updateRowData() {
    console.log('UPDATING ROW DATA');
    if (this.currentPhenotype?.class_name && classDefinitions[this.currentPhenotype.class_name]) {
      let paramDefinitions = classDefinitions[this.currentPhenotype.class_name];
      // filter out the non user visible params
      paramDefinitions = paramDefinitions.filter(paramDef => paramDef.user_visible);

      const requiredParams = paramDefinitions.filter(paramDef => paramDef.required);
      const nonRequiredParams = paramDefinitions.filter(paramDef => !paramDef.required);
      const sharedParams = ['name', 'type', 'class_name'].map(param => ({
        parameter: param,
        value: this.currentPhenotype![param] || 'Not set',
        ...this.currentPhenotype,
      }));

      console.log('IS IS THE PHENOTYP SHARED PARMS', sharedParams);

      this.rowData = [
        ...sharedParams,
        ...paramDefinitions.map(paramDef => ({
          parameter: paramDef.param,
          value: this.currentPhenotype![paramDef.param]
            ? this.currentPhenotype![paramDef.param]
            : paramDef.default,
          ...this.currentPhenotype,
        })),
      ];
    } else {
      this.rowData = [];
    }
  }

  public addListener(listener: () => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: () => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners(refreshGrid: boolean = false) {
    console.log('NOTIFYING LISTENERS', this.listeners);
    this.listeners.forEach(listener => listener(refreshGrid));
  }

  public formatType(): string {}

  public getPhenotypeType() {
    return this.currentPhenotype?.type || 'Not set';
  }

  public getCohortName() {
    return this.cohortDataService._cohort_name;
  }

  public updateComponentPhenotypeData() {
    this.componentPhenotypeTableData = this.cohortDataService.tableDataForComponentPhenotype(
      this.currentPhenotype
    );
    console.log('THIS IS COMPONENT PHENOTYPE DATA', this.componentPhenotypeTableData);
    console.log(this.cohortDataService);
  }

  public addNewComponentPhenotype() {
    this.cohortDataService.addPhenotype('component', this.currentPhenotype?.id);
    this.updateComponentPhenotypeData();
    this.notifyComponentPhenotypeListeners(true);
  }

  public addComponentPhenotypeListener(listener: () => void) {
    this.componentPhenotypeListeners.push(listener);
  }

  public removeComponentPhenotypeListener(listener: () => void) {
    this.componentPhenotypeListeners = this.componentPhenotypeListeners.filter(l => l !== listener);
  }

  private notifyComponentPhenotypeListeners(refreshGrid: boolean = false) {
    console.log('NOTIFYING LISTENERS', this.componentPhenotypeListeners);
    this.componentPhenotypeListeners.forEach(listener => listener(refreshGrid));
  }

  // public onCellValueChanged(event: any) {
  //   this.cohortDataService.onCellValueChanged(event);
  // }
}
