import { themeQuartz } from 'ag-grid-community';
import classDefinitions from '../../assets/class_definitions.json';
import { defaultColumns } from './PhenotypeColumnDefinitions';
import {CohortDataService} from '../CohortViewer/CohortDataService/CohortDataService'
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
  private listeners: ((refreshGrid: boolean) => void)[] = [];

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
      borderColor: '#AFAFAF26',
      browserColorScheme: 'light',
      columnBorder: true,
      headerFontSize: 11,
      headerRowBorder: true,
      cellHorizontalPadding: 10,
      headerBackgroundColor: 'var(--background-color-content, #FFFFFF)',
      rowBorder: true,
      spacing: 8,
      wrapperBorder: false,
    });
  }

  public setData(data: Phenotype | undefined) {
    console.log('SETTING DATA');
    this.currentPhenotype = data || null;
    this.updateRowData();
    this.notifyListeners(true);
  }

  public getData(): Phenotype | null {
    return this.currentPhenotype;
  }

  public getRowData(): ParamRow[] {
    return this.rowData;
  }

  public valueChanged(rowData:ParamRow, newValue:any) {
    if (this.currentPhenotype) {
      this.currentPhenotype[rowData.parameter] = newValue;
      this.saveChangesToPhenotype()
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
      const paramDefinitions = classDefinitions[this.currentPhenotype.class_name];
      const requiredParams = paramDefinitions.filter(paramDef => paramDef.required);
      const nonRequiredParams = paramDefinitions.filter(paramDef => !paramDef.required);
      console.log("THIS IS THE PHENOTYPE", this.currentPhenotype)
      const sharedParams = ['class_name'].map(param => ({
        parameter: param,
        value: this.currentPhenotype![param] || 'Not set',
        ...this.currentPhenotype
      }));

      console.log("IS IS THE PHENOTYP SHARED PARMS", sharedParams)
      
      this.rowData = [
        ...sharedParams,
        ...requiredParams.map(paramDef => ({
          parameter: paramDef.param,
          value:
            this.currentPhenotype![paramDef.param]?
            this.currentPhenotype![paramDef.param]:
            paramDef.default,
          ...this.currentPhenotype
        })).filter(row => row.parameter !== 'name').sort((a, b) => a.parameter.localeCompare(b.parameter)),
        ...nonRequiredParams.map(paramDef => ({
          parameter: paramDef.param,
          value:
            this.currentPhenotype![paramDef.param]?
            this.currentPhenotype![paramDef.param]:
            paramDef.default,
          ...this.currentPhenotype
        })).filter(row => row.parameter !== 'name').sort((a, b) => a.parameter.localeCompare(b.parameter))
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

  private notifyListeners(refreshGrid:boolean=false) {
    console.log('NOTIFYING LISTENERS', this.listeners);
    this.listeners.forEach(listener => listener(refreshGrid));
  }

  public formatType(): string {

  }

  public getPhenotypeType(){
    return this.currentPhenotype?.type || 'Not set';
  }

  public getCohortName(){
    return this.cohortDataService._cohort_name;
  }
}
