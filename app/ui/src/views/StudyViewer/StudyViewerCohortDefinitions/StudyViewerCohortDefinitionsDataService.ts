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
    console.log('Preparing cohort table data for:', cohort.name);
    console.log('Cohort phenotypes:', cohort.phenotypes);
    console.log("COHORT DATA", cohort)
    // Filter phenotypes by type (entry, inclusion, exclusion) - similar to tableDataForComponentPhenotype
    let filteredPhenotypes = cohort.cohort_data.phenotypes || [];
    
    console.log('All phenotypes before filter:', filteredPhenotypes);
    console.log('Phenotype types found:', filteredPhenotypes.map(p => p.type));
    
    filteredPhenotypes = filteredPhenotypes.filter(
      (phenotype: any) =>
        phenotype.type === 'entry' ||
        phenotype.type === 'inclusion' ||
        phenotype.type === 'exclusion'
    );

    console.log('Filtered phenotypes:', filteredPhenotypes);

    // Add colorCellBorder property to each phenotype
    const phenotypesWithColorSettings = filteredPhenotypes.map((phenotype: any) => ({
      ...phenotype,
      colorCellBorder: false,
    }));

    return {
      rows: phenotypesWithColorSettings,
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
