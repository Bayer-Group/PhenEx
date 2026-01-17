import { TableData, TableRow } from '../../CohortViewer/tableTypes';
import { CohortWithTableData, cohortDefinitionColumns } from './StudyViewerCohortDefinitionsTypes';
import { CohortModel } from '../../CohortViewer/CohortDataService/CohortModel';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';

// Data service for StudyViewerCohortDefinitions
export class StudyViewerCohortDefinitionsDataService {
  private _study_data: Record<string, any> = {};
  private _studyDataService: any;
  private _cohortModels: Map<string, CohortModel> = new Map(); // Store CohortModel instances by cohort ID
  private _activeCohortId: string | null = null; // Track which cohort is currently active
  private _listeners: Array<() => void> = []; // Listeners for when cohort data changes

  constructor() {
    this._study_data = {};
  }

  public setStudyDataService(studyDataService: any): void {
    this._studyDataService = studyDataService;
  }

  public setStudyData(studyData: Record<string, any>): void {
    this._study_data = studyData;
  }

  /**
   * Prepares table data for a single cohort's definition phenotypes
   * @param cohort The cohort data object
   * @returns TableData object with rows containing entry, inclusion, and exclusion phenotypes
   */
  private prepareCohortTableData(cohort: Record<string, any>): TableData {
    // Reuse existing model or create new one
    let model = this._cohortModels.get(cohort.id);
    if (!model) {
      model = new CohortModel();
      model.loadCohortData(cohort);
      this._cohortModels.set(cohort.id, model);
      
      // Subscribe to model changes to notify StudyViewer
      const modelListener = () => {
        console.log('[StudyViewer] CohortModel changed for cohort:', cohort.id);
        this.notifyListeners();
      };
      model.addListener(modelListener);
    }
    
    const tableData = model.table_data;
    
    return {
      rows: tableData.rows,
      columns: cohortDefinitionColumns,
    };
  }

  /**
   * Gets all cohorts with their corresponding table data
   * @returns Array of objects containing both cohort data and prepared table data
   */
  public getCohortDefinitions(): CohortWithTableData[] {
    const cohorts = this._study_data.cohorts || [];
    return cohorts.map(cohort => ({
      cohort,
      table_data: this.prepareCohortTableData(cohort)
    }));
  }

  public getCohorts(): any[] {
    return this._study_data.cohorts || [];
  }

  /**
   * Sets the active cohort model in the singleton CohortDataService
   * Call this before editing a phenotype to ensure edits are saved to the correct cohort
   * @param cohortId The ID of the cohort to set as active
   */
  public setActiveCohort(cohortId: string): void {
    console.log('[StudyViewer] setActiveCohort called with:', cohortId);
    const model = this._cohortModels.get(cohortId);
    if (model) {
      this._activeCohortId = cohortId;
      console.log('[StudyViewer] Setting cohort as active, model found:', model.cohort_data?.id);
      const cohortDataService = CohortDataService.getInstance();
      cohortDataService.setActiveCohortModel(model);
    } else {
      console.warn('[StudyViewer] No model found for cohortId:', cohortId);
    }
  }

  /**
   * Gets the ID of the currently active cohort
   * @returns The active cohort ID or null if none is set
   */
  public getActiveCohortId(): string | null {
    console.log('[StudyViewer] getActiveCohortId returning:', this._activeCohortId);
    return this._activeCohortId;
  }

  /**
   * Gets the cohort ID that a phenotype belongs to
   * @param phenotypeId The ID of the phenotype
   * @returns The cohort ID or null if not found
   */
  public getCohortIdForPhenotype(phenotypeId: string): string | null {
    for (const [cohortId, model] of this._cohortModels.entries()) {
      const phenotype = model.getPhenotypeById(phenotypeId);
      if (phenotype) {
        return cohortId;
      }
    }
    return null;
  }

  /**
   * Refreshes a single cohort's data by getting from the stored model
   * @param cohortId The ID of the cohort to refresh
   * @returns Updated CohortWithTableData or null if cohort not found
   */
  public refreshSingleCohort(cohortId: string): CohortWithTableData | null {
    console.log('[StudyViewer] refreshSingleCohort called for:', cohortId);
    // Get the model from our Map (it's the same instance that's active in the singleton)
    const model = this._cohortModels.get(cohortId);
    if (!model) {
      console.warn('[StudyViewer] refreshSingleCohort: No model found for:', cohortId);
      return null;
    }

    // Get the updated data directly from the model
    const cohortData = model.cohort_data;
    const tableData = model.table_data;
    console.log('[StudyViewer] refreshSingleCohort: Got data, rows:', tableData.rows.length);
    
    // Use only the columns we need for study viewer
    return {
      cohort: cohortData,
      table_data: {
        rows: tableData.rows,
        columns: cohortDefinitionColumns
      }
    };
  }

  /**
   * Add a listener to be notified when cohort data changes
   */
  public addListener(listener: () => void): void {
    this._listeners.push(listener);
  }

  /**
   * Remove a listener
   */
  public removeListener(listener: () => void): void {
    this._listeners = this._listeners.filter(l => l !== listener);
  }

  /**
   * Notify all listeners that cohort data has changed
   */
  private notifyListeners(): void {
    this._listeners.forEach(listener => listener());
  }

  /**
   * Handle cell value changes for a specific cohort
   * @param cohortId The ID of the cohort whose cell was changed
   * @param event The cell change event from AG Grid
   * @param selectedRows Optional array of selected rows
   */
  public async onCellValueChanged(cohortId: string, event: any, selectedRows?: any[]): Promise<void> {
    console.log('[StudyViewer] onCellValueChanged for cohort:', cohortId);
    const model = this._cohortModels.get(cohortId);
    if (!model) {
      console.warn('[StudyViewer] No model found for cohortId:', cohortId);
      return;
    }

    // Set this cohort as active before making changes
    const cohortDataService = CohortDataService.getInstance();
    cohortDataService.setActiveCohortModel(model);
    this._activeCohortId = cohortId;

    // Delegate to the model's onCellValueChanged handler
    await cohortDataService.onCellValueChanged(event, selectedRows);
  }
}
