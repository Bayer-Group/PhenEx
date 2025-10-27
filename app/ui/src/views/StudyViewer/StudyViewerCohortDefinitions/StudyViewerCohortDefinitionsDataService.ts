import { TableData } from '../../CohortViewer/tableTypes';
import { CohortWithTableData, cohortDefinitionColumns } from './StudyViewerCohortDefinitionsTypes';

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
    const rows = [];
    
    // Add entry criterion if it exists
    if (cohort.entry_criterion) {
      rows.push({
        ...cohort.entry_criterion,
        type: 'entry',
      });
    }

    // Add inclusion criteria
    if (Array.isArray(cohort.inclusions)) {
      rows.push(...cohort.inclusions.map(phenotype => ({
        ...phenotype,
        type: 'inclusion',
      })));
    }

    // Add exclusion criteria
    if (Array.isArray(cohort.exclusions)) {
      rows.push(...cohort.exclusions.map(phenotype => ({
        ...phenotype,
        type: 'exclusion',
      })));
    }
    console.log("PREPARING COHROT", cohort)
    return {
      rows:rows,
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
