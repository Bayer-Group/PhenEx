import { TableData, TableRow } from '../../CohortViewer/tableTypes';
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

    filteredPhenotypes = this.getHierarchicallyOrderedPhenotypes(filteredPhenotypes);
    
    console.log('All phenotypes before filter:', filteredPhenotypes);
    console.log('Phenotype types found:', filteredPhenotypes.map(p => p.type));
    
    // filteredPhenotypes = filteredPhenotypes.filter(
    //   (phenotype: any) =>
    //     phenotype.type === 'entry' ||
    //     phenotype.type === 'inclusion' ||
    //     phenotype.type === 'exclusion' ||
    // );

    // console.log('Filtered phenotypes:', filteredPhenotypes);

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

  //TODO REFACTOR THE FOLLOWING TWO METHODS; THIS IS A DUPLICATION OF CODE FROM COHORTDATASERVICE
    private getHierarchicallyOrderedPhenotypes(phenotypes: TableRow[]): TableRow[] {
      const result: TableRow[] = [];
      
      // Separate phenotypes by type, maintaining original order for non-components
      const order = ['entry', 'inclusion', 'exclusion', 'baseline', 'outcome'];
      const componentPhenotypes = phenotypes.filter(p => p.type === 'component');
      
      for (const type of order) {
        const phenotypesOfType = phenotypes.filter(p => p.type === type);
        
        for (const phenotype of phenotypesOfType) {
          // Add the parent phenotype
          result.push(phenotype);
          
          // Add all its component descendants in hierarchical order
          const descendants = this.getComponentDescendantsHierarchically(phenotype.id, componentPhenotypes);
          result.push(...descendants);
        }
      }
      
      // Add any orphaned components (components without parents in the filtered list)
      const addedComponentIds = new Set(result.filter(p => p.type === 'component').map(p => p.id));
      const orphanedComponents = componentPhenotypes.filter(c => !addedComponentIds.has(c.id));
      result.push(...orphanedComponents);
      
      return result;
    }
  
    private getComponentDescendantsHierarchically(parentId: string, componentPhenotypes: TableRow[]): TableRow[] {
    const result: TableRow[] = [];
    
    // Find direct children of this parent
    const directChildren = componentPhenotypes.filter(
      (phenotype: TableRow) =>
        phenotype.parentIds && 
        Array.isArray(phenotype.parentIds) && 
        phenotype.parentIds.includes(parentId)
    );
    
    // Sort direct children by their index if available
    directChildren.sort((a, b) => (a.index || 0) - (b.index || 0));
    
    // For each direct child, add it and then recursively add its descendants
    for (const child of directChildren) {
      result.push(child);
      const childDescendants = this.getComponentDescendantsHierarchically(child.id, componentPhenotypes);
      result.push(...childDescendants);
    }
    
    return result;
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
