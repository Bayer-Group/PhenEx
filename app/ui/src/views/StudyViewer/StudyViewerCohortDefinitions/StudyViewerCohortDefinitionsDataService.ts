import { TableData, TableRow } from '../../CohortViewer/tableTypes';
import { CohortWithTableData, cohortDefinitionColumns } from './StudyViewerCohortDefinitionsTypes';
import { CohortModel } from '../../CohortViewer/CohortDataService/CohortModel';

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
    // Configure the model so it produces the table data we expect
    // We only need to show entry, inclusion, exclusion by default in the card view, 
    // but the CohortModel defaults match this reasonably well or we can rely on it to handle logic.
    // The previous implementation filtered: 'entry', 'inclusion', 'exclusion'.
    // CohortModel by default might show everything or filter?
    // CohortModel has private _currentFilter = ['entry', 'inclusion', 'exclusion'].
    // So it matches perfectly.
    
    // We construct the input object expected by loadCohortData
    // We pass the full study data and the specific cohort data
    const loadData = {
      cohort_data: cohort,
      study: this._study_data
    };
    
    model.loadCohortData(loadData);
    
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
}
