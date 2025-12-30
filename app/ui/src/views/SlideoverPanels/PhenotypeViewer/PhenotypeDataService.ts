import { themeQuartz } from 'ag-grid-community';
import classDefinitionsRaw from '/assets/class_definitions.json?raw';
let classDefinitions = JSON.parse(classDefinitionsRaw);
import { defaultColumns } from './PhenotypeColumnDefinitions';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';
import typeStyles from '../../../styles/study_types.module.css'
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
  ];

  public componentPhenotypeTableData: TableData = {
    rows: [],
    columns: [],
  };

  private listeners: ((refreshGrid: boolean) => void)[] = [];
  private componentPhenotypeListeners: ((refreshGrid: boolean) => void)[] = [];
  public cohortDataService = CohortDataService.getInstance(); // Assuming CohortDataService is a singleton class

  private constructor() {
    // Listen to cohort data changes to refresh current phenotype
    this.cohortDataService.addDataChangeListener(() => {
      this.refreshCurrentPhenotypeFromCohort();
    });
  }

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
      borderColor: 'transparent',
      browserColorScheme: 'light',
      columnBorder: true,
      headerFontSize: 14,
      headerFontWeight: 'bold',
      headerRowBorder: true,
      fontSize: '20px',
      cellHorizontalPadding: 10,
      // headerBackgroundColor: `var(--color_${this.currentPhenotype?.effective_type || ''}_dim)` || '',
      // backgroundColor: `var(--color_${this.currentPhenotype?.effective_type || ''}_dim)` || '',
      headerBackgroundColor: 'transparent',
      backgroundColor: 'transparent',
      rowBorder: true,
      spacing: 8,
      wrapperBorder: false,
      wrapperBorderRadius: 0,
    });
  }

  public setData(data: Phenotype | undefined) {
    // Always reference the actual phenotype from the cohort, not the passed-in data object
    if (data?.id) {
      const phenotypeInCohort = this.cohortDataService.cohort_data.phenotypes.find(
        (p: any) => p.id === data.id
      );
      this.currentPhenotype = phenotypeInCohort || data;
    } else {
      this.currentPhenotype = data || null;
    }
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

  public valueChanged(parameter: string, newValue: any) {
    console.log("SETTING VALUE changed", parameter, newValue);
    if (this.currentPhenotype) {
      console.log("entering", this.currentPhenotype[parameter]);
      this.currentPhenotype[parameter] = newValue;
      console.log("after", this.currentPhenotype[parameter]);

      if (parameter === 'class_name'){
        this.updateRowData()
      }
      this.saveChangesToPhenotype(parameter === 'class_name' ? true : false);
      console.log("after refresh", this.currentPhenotype[parameter]);

    }
  }

  public saveChangesToPhenotype(refreshGrid:boolean = false) {
    if (this.currentPhenotype) {
      this.notifyListeners(true);
      this.cohortDataService.saveChangesToCohort(false, true);
    }
  }

  // Called when cohort data changes to refresh current phenotype from updated cohort data
  public refreshCurrentPhenotypeFromCohort() {
    if (this.currentPhenotype?.id) {
      // Find the updated phenotype in the cohort data
      const updatedPhenotype = this.cohortDataService.cohort_data.phenotypes.find(
        (p: any) => p.id === this.currentPhenotype!.id
      );
      
      if (updatedPhenotype) {
        // Update current phenotype reference with latest data
        this.currentPhenotype = updatedPhenotype;
        this.updateRowData();
        
        // Also refresh component phenotype table data
        this.updateComponentPhenotypeData();
        
        // Notify both regular and component phenotype listeners
        this.notifyListeners(true);
        this.notifyComponentPhenotypeListeners(true);
      }
    }
  }

  private updateRowData() {
    if (this.currentPhenotype?.class_name && classDefinitions[this.currentPhenotype.class_name]) {
      let paramDefinitions = classDefinitions[this.currentPhenotype.class_name];
      // filter out the non user visible params
      paramDefinitions = paramDefinitions.filter(paramDef => paramDef.user_visible);

      const requiredParams = paramDefinitions.filter(paramDef => paramDef.required);
      const nonRequiredParams = paramDefinitions.filter(paramDef => !paramDef.required);
      //const sharedParams = ['name', 'type', 'class_name'].map(param => ({
      const sharedParams = ['class_name'].map(param => ({

        parameter: param,
        value: this.currentPhenotype![param] || 'Not set',
        ...this.currentPhenotype,
      }));


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
    this.componentPhenotypeListeners.forEach(listener => listener(refreshGrid));
  }

  // public onCellValueChanged(event: any) {
  //   this.cohortDataService.onCellValueChanged(event);
  // }
}
