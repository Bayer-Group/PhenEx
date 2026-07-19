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
  // Panel-local visibility state, independent from the main cohort table.
  // Direct children are always shown; this toggle additionally reveals deeper
  // generations (subchildren) up to `_componentLevel`.
  private _showSubchildren: boolean = true;
  // Max component depth shown when subchildren are enabled. Level 1 = direct
  // children, level 2 = grandchildren; `Infinity` shows the full subtree.
  private _componentLevel: number = Number.POSITIVE_INFINITY;
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
    return this.cohortDataService.cohort_name;
  }

  /**
   * Ordered list of phenotypes the user can page through in the phenotype
   * viewer. Uses the cohort table's visible order and excludes rows that are
   * only present as deleted (struck-through) entries.
   */
  public getNavigablePhenotypes(): Phenotype[] {
    const rows = this.cohortDataService.table_data?.rows ?? [];
    const validIds = new Set(
      (this.cohortDataService.cohort_data?.phenotypes ?? []).map((p: any) => p.id)
    );
    return rows.filter((row: any) => validIds.has(row.id)) as Phenotype[];
  }

  public updateComponentPhenotypeData() {
    // Always show direct children (level 1); the toggle extends the depth to
    // include subchildren (level 2+) up to the selected level.
    const maxLevel = this._showSubchildren ? this._componentLevel : 1;
    this.componentPhenotypeTableData = this.cohortDataService.tableDataForComponentPhenotype(
      this.currentPhenotype,
      true,
      maxLevel
    );
  }

  public getShowSubchildren(): boolean {
    return this._showSubchildren;
  }

  public setShowSubchildren(show: boolean) {
    this._showSubchildren = show;
    this.updateComponentPhenotypeData();
    this.notifyComponentPhenotypeListeners(true);
  }

  public getComponentLevel(): number {
    return this._componentLevel;
  }

  public setComponentLevel(level: number) {
    this._componentLevel = level;
    this.updateComponentPhenotypeData();
    this.notifyComponentPhenotypeListeners(true);
  }

  // Deepest component level available under the selected phenotype (direct
  // children = level 1). Drives the level dropdown's dynamic range.
  public getMaxComponentLevel(): number {
    if (!this.currentPhenotype?.id) return 0;
    return this.cohortDataService.getMaxComponentLevelForPhenotype(this.currentPhenotype.id);
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
