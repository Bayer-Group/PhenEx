import { TableData, ColumnDefinition, TableRow } from '../CohortViewer/tableTypes';
import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';

import { executeStudy } from '../../api/execute_cohort/route';

import {
  getUserCohort,
  getPublicCohort,
  updateCohort,
  deleteCohort,
  getStudy,
  updateStudy
} from '../../api/text_to_cohort/route';
import { createID } from '../../types/createID';

// export abstract class StudyDataService {
export class StudyDataService {
  private static instance: StudyDataService;
  public _study_name: string = '';
  private _study_data: Record<string, any> = {};
  private _cohortDataService: CohortDataService | null = null;
  
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


  public async loadStudyData(studyIdentifiers: string): Promise<void> {
    try {
      let studyResponse = undefined;
      try {
        studyResponse = await getStudy(studyIdentifiers.id);
      } catch {
        console.log("Error loading study")
      }

      this._study_data = studyResponse;
      this._study_name = this._study_data.name || 'Unnamed Study';
      if (!this._study_data.id) {
        this._study_data.id = createID();
      }
      // Ensure phenotypes array exists
      if (!this._study_data.cohorts) {
        this._study_data.cohorts = [];
      }

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
    //   database_config: {},
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
    await updateStudy(this._study_data.id, this._study_data);
    this.notifyNameChangeListeners();
    if (refreshGrid) {
      this.notifyStudyDataServiceListener();
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
      await deleteCohort(this._study_data.id);
      this._study_data = {};
      this._study_name = '';
      this.notifyStudyDataServiceListener();
      this.notifyNameChangeListeners();
    }
  }
}
