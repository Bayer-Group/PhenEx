import { TableData, ColumnDefinition, TableRow } from '../CohortViewer/tableTypes';
import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';


import {
  deleteStudy,
  getStudy,
  updateStudy,
  updateStudyDatabaseConfig
} from '../../api/text_to_cohort/route';
import { createID } from '../../types/createID';
import { StudyViewerCohortDefinitionsDataService } from './StudyViewerCohortDefinitions/StudyViewerCohortDefinitionsDataService';

// export abstract class StudyDataService {
export class StudyDataService {
  private static instance: StudyDataService;
  public _study_name: string = '';
  private _study_data: Record<string, any> = {};
  private _cohortDataService: CohortDataService | null = null;
  private _cohort_definitions_service: StudyViewerCohortDefinitionsDataService;
  public exportStudyCallback: (() => Promise<void>) | null = null;
  
  private constructor() {
    this._cohort_definitions_service = new StudyViewerCohortDefinitionsDataService();
    this._cohort_definitions_service.setStudyDataService(this);
  }

  public get cohort_definitions_service(): StudyViewerCohortDefinitionsDataService {
    return this._cohort_definitions_service;
  }
  
  private get cohortDataService(): CohortDataService {
    if (!this._cohortDataService) {
      this._cohortDataService = CohortDataService.getInstance();
    }
    return this._cohortDataService;
  }
  
  public static getInstance(): StudyDataService {
    if (!StudyDataService.instance) {
      StudyDataService.instance = new StudyDataService();
    }
    return StudyDataService.instance;
  }

  public get study_name(): string {
    return this._study_name;
  }

  public set study_name(value: string) {
    this._study_name = value;
  }

  public get study_data(): Record<string, any> {
    return this._study_data;
  }

  public set study_data(value: Record<string, any>) {
    this._study_data = value;
  }

  public get database(): Record<string, any> | null {
    return this._study_data?.database ?? null;
  }

  public async setDatabaseConfig(config: Record<string, any> | null): Promise<void> {
    this._study_data.database = config;
    await updateStudyDatabaseConfig(this._study_data.id, config);
  }


  public loadStudyData(studyData: any) {
    try {
      this._study_data = studyData;
      this._study_name = this._study_data.name || 'Unnamed Study';
      if (!this._study_data.id) {
        this._study_data.id = createID();
      }
      // Ensure phenotypes array exists
      if (!this._study_data.cohorts) {
        this._study_data.cohorts = [];
      }

      // Update the cohort definitions service with the new study data
      this._cohort_definitions_service.setStudyData(this._study_data);
      
      this.notifyStudyDataServiceListener(); // Notify listeners after loading data
    } catch (error) {
      console.error('Error loading study data:', error);
    }
  }

  public async createNewStudy() {
    /*
    Creates an in memory cohort (empty) data structure new cohort. This is not saved to disk! only when user inputs any changes to the cohort are changes made
    */
    // this._cohort_data = {
    //   id: createID(),
    //   name: 'Name your cohort...',
    //   class_name: 'Cohort',
    //   phenotypes: [],
    //   database: {},
    //   constants: [],
    // };
    // this._cohort_name = this._cohort_data.name;
    // this._table_data = this.tableDataFromCohortData();
    // this.constants_service.refreshConstants();
    // this.isNewCohort = true;
    // this.notifyListeners(); // Notify listeners after initialization
    // this.isNewCohort = false;
  }

  public addCohort(type: string = 'NA', parentPhenotypeId: string | null = null) {
    // ensure that cohort only has one entry phenotype
    if (type === 'entry') {
      const existingEntryPhenotype = this._study_data.phenotypes.find(
        (row: TableRow) => row.type === 'entry'
      );
      if (existingEntryPhenotype) {
        return;
      }
    }
    const newPhenotype: TableRow = {
      id: createID(),
      type: type,
      name: 'Unnamed Phenotype',
      class_name: 'CodelistPhenotype',
      level: 0,
    };
    if (parentPhenotypeId) {
      newPhenotype.parentIds = [parentPhenotypeId];
      newPhenotype.level = (this.getAllAncestors(newPhenotype).length);
      
      // Set effective_type for component phenotypes based on root ancestor
      if (type === 'component') {
        const ancestors = this.getAllAncestors(newPhenotype);
        if (ancestors.length > 0) {
          // Find the root ancestor (first non-component type, or the last ancestor)
          const rootAncestor = ancestors.find(ancestor => ancestor.type !== 'component') || ancestors[ancestors.length - 1];
          newPhenotype.effective_type = rootAncestor.effective_type || rootAncestor.type;
        }
      }
    } 


    // Set effective_type for non-component phenotypes (they are their own effective type)
    if (type !== 'component') {
      newPhenotype.effective_type = type;
    } 

    this._study_data.phenotypes.push(newPhenotype);
    this.saveChangesToStudy(true, true);
  }

  public async saveChangesToStudy(changesToStudy: boolean = true, refreshGrid: boolean = true) {
    if (changesToStudy) {
    }
    this._study_data.name = this._study_name;
    
    // Strip out cohorts to avoid circular reference (cohorts contain study reference)
    const { cohorts, ...studyDataForBackend } = this._study_data;
    console.log('💾 Saving study to backend (without cohorts):', studyDataForBackend);
    
    await updateStudy(this._study_data.id, studyDataForBackend);
    this.notifyNameChangeListeners();
    if (refreshGrid) {
      this.notifyStudyDataServiceListener();
    }
  }

  public async refreshStudyData() {
    if (!this._study_data.id) {
      console.warn('No study ID to refresh');
      return;
    }

    try {
      const studyId = this._study_data.id;
      console.log('🔄 Refreshing study data for study:', studyId);
      
      // Fetch fresh study data from API
      const studyData = await getStudy(studyId);
      
      // Fetch cohorts for this study (clear cache first to ensure fresh data)
      const { CohortsDataService } = await import('../LeftPanel/CohortsDataService');
      const cohortsDataService = CohortsDataService.getInstance();
      cohortsDataService.clearStudyCohortsCache(studyId);
      const cohorts = await cohortsDataService.getCohortsForStudy(studyId);
      cohortsDataService.notifyListeners();
      
      // Add cohorts to study data
      const updatedStudyData = { ...studyData, cohorts };
      
      // Reload the data which will notify all listeners
      this.loadStudyData(updatedStudyData);
      
      console.log('✅ Study data refreshed successfully');
    } catch (error) {
      console.error('❌ Failed to refresh study data:', error);
    }
  }


  public getCohortById(id: string): TableRow | undefined {
    return this._study_data.phenotypes.find(
      (phenotype: TableRow) => phenotype.id === id
    );
  }

  public deleteCohort(id: string) {
    const phenotypeToDelete = this.getPhenotypeById(id);
    if (!phenotypeToDelete) {
      return null;
    }

    const idsToRemove: string[] = [id];
    
    // If this is a component phenotype, also get all its descendants
    if (phenotypeToDelete.type === 'component') {
      const descendants = this.getAllDescendants(id);
      idsToRemove.push(...descendants.map(desc => desc.id));
    }

    // Also find any component phenotypes that have this phenotype as an ancestor
    // (component phenotypes that would become orphaned)
    const componentPhenotypes = this._study_data.phenotypes.filter(
      (phenotype: TableRow) => phenotype.type === 'component'
    );

    for (const component of componentPhenotypes) {
      const ancestors = this.getAllAncestors(component);
      if (ancestors.some(ancestor => ancestor.id === id)) {
        if (!idsToRemove.includes(component.id)) {
          idsToRemove.push(component.id);
          // Also get descendants of this component
          const componentDescendants = this.getAllDescendants(component.id);
          componentDescendants.forEach(desc => {
            if (!idsToRemove.includes(desc.id)) {
              idsToRemove.push(desc.id);
            }
          });
        }
      }
    }

    // Remove all identified phenotypes
    this._study_data.phenotypes = this._study_data.phenotypes.filter(
      (phenotype: TableRow) => !idsToRemove.includes(phenotype.id)
    );

    this.saveChangesToStudy();
    return {
      remove: idsToRemove,
    };
  }


  private listeners: Array<() => void> = [];

  public addStudyDataServiceListener(listener: () => void) {
    this.listeners.push(listener);
  }

  public removeStudyDataServiceListener(listener: () => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyStudyDataServiceListener() {
    this.listeners.forEach(listener => listener());
  }

  /**
   * If the currently loaded study matches `studyId`, update its name and notify
   * listeners. No-op otherwise. Keeps the breadcrumb / study viewer in sync with
   * renames made elsewhere (e.g. the left panel).
   */
  public updateNameIfCurrent(studyId: string, name: string): boolean {
    if (this._study_data?.id !== studyId) return false;
    this._study_name = name;
    this._study_data.name = name;
    this.notifyStudyDataServiceListener();
    return true;
  }

  /**
   * If the currently loaded study matches `studyId`, reorder its cohorts to match
   * `orderedCohortIds` and notify listeners. No-op otherwise. Keeps the study
   * viewer's cohort order in sync with reorders made elsewhere (e.g. the left panel).
   */
  public updateCohortOrderIfCurrent(studyId: string, orderedCohortIds: string[]): boolean {
    if (this._study_data?.id !== studyId) return false;
    const cohorts: any[] = this._study_data.cohorts || [];
    const byId = new Map(cohorts.map(c => [c.id, c]));
    const reordered = orderedCohortIds
      .map(id => byId.get(id))
      .filter((c): c is any => c !== undefined);
    // Preserve any cohorts not present in the ordered list.
    for (const c of cohorts) {
      if (!orderedCohortIds.includes(c.id)) reordered.push(c);
    }
    this._study_data.cohorts = reordered;
    this._cohort_definitions_service.setStudyData(this._study_data);
    this.notifyStudyDataServiceListener();
    return true;
  }

  private nameChangeListeners: Array<() => void> = [];

  public addNameChangeListener(listener: () => void) {
    this.nameChangeListeners.push(listener);
  }

  public removeNameChangeListener(listener: () => void) {
    const index = this.nameChangeListeners.indexOf(listener);
    if (index > -1) {
      this.nameChangeListeners.splice(index, 1);
    }
  }

  private notifyNameChangeListeners() {
    this.nameChangeListeners.forEach(listener => listener());
  }

  public updateStudyFromChat(newStudy) {
    this._study_data = newStudy;
    this.notifyStudyDataServiceListener();
  }
  
  async deleteStudy() {
    if (this._study_data.id) {
      await deleteStudy(this._study_data.id);
      this._study_data = {};
      this._study_name = '';
      this.notifyStudyDataServiceListener();
      this.notifyNameChangeListeners();
    }
  }
}
