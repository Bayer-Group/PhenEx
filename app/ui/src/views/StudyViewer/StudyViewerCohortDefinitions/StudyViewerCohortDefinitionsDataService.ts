import { TableData, TableRow } from '../../CohortViewer/tableTypes';
import { CohortWithTableData, cohortDefinitionColumns } from './StudyViewerCohortDefinitionsTypes';
import { CohortModel } from '../../CohortViewer/CohortDataService/CohortModel';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';

// Data service for StudyViewerCohortDefinitions
export class StudyViewerCohortDefinitionsDataService {
  private _study_data: Record<string, any> = {};
  private _studyDataService: any;

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
    const model = new CohortModel();

  
    
    model.loadCohortData(cohort);
    
    // Check if we need to customize column definitions (StudyViewer used cohortDefinitionColumns)
    // The previous implementation returned: columns: cohortDefinitionColumns
    // CohortModel uses: columns: defaultColumns (from ./CohortColumnDefinitions)
    // We might need to override the columns on the result if they differ.
    // The import 'cohortDefinitionColumns' was used.
    // I should check if I need to preserve 'cohortDefinitionColumns'.
    // The user said "factor out all the things about the cohortdataservice... providing all functionality".
    // If I use the model's table_data, I get the model's columns.
    // If StudyViewer needs specialized columns, I should overwrite them.
    
    const tableData = model.table_data;
    // Overwrite columns to match the specific view requirements if needed
    // The previous code imported cohortDefinitionColumns. Let's keep using them for consistency in this view.
    
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
   * Refreshes a single cohort's data by re-fetching from the singleton CohortDataService
   * @param cohortId The ID of the cohort to refresh
   * @returns Updated CohortWithTableData or null if cohort not found
   */
  public refreshSingleCohort(cohortId: string): CohortWithTableData | null {
    const cohortDataService = CohortDataService.getInstance();
    
    // Get the updated cohort data from the singleton
    const updatedCohort = cohortDataService.cohort_data;
    
    // Verify this is the cohort we want to refresh
    if (updatedCohort.id !== cohortId) {
      return null;
    }

    // Get table data directly from the singleton's active model (already loaded and up-to-date)
    const tableData = cohortDataService.table_data;
    
    // Use only the columns we need for study viewer
    return {
      cohort: updatedCohort,
      table_data: {
        rows: tableData.rows,
        columns: cohortDefinitionColumns
      }
    };
  }
}
