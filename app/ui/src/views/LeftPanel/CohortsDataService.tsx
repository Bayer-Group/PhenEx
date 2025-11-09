import { createID } from '../../types/createID';
import { 
  getPublicCohorts, 
  getUserCohorts, 
  updateCohort,
  getUserStudies,
  getPublicStudies,
  getCohortsForStudy,
  createNewStudy,
  updateStudy,
  updateStudyDisplayOrder,
  updateCohortDisplayOrder
} from '../../api/text_to_cohort/route';
import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';

export interface StudyData {
  id: string;
  name: string;
  description?: string;
  is_public: boolean;
  creator_id: string;
  visible_by: string[];
  display_order?: number;
}

export interface CohortData {
  id: string;
  name: string;
  study_id: string;
  parent_cohort_id?: string;
  display_order?: number;
  study?: StudyData;
}

export class CohortsDataService {
  private static instance: CohortsDataService;
  private _publicCohortNamesAndIds: any[] | null = null;
  private _userCohortNamesAndIds: any[] | null = null;
  private _userStudies: StudyData[] | null = null;
  private _publicStudies: StudyData[] | null = null;
  private _studyCohortsCache: Map<string, CohortData[]> = new Map();

  private cohortDataService: CohortDataService;

  public async publicCohortNamesAndIds() {
    if (this._publicCohortNamesAndIds === null) {
      try {
        this._publicCohortNamesAndIds = await getPublicCohorts();
      } catch (error) {
        console.warn('🚨 Failed to fetch public cohorts, likely auth not ready:', error);
        this._publicCohortNamesAndIds = [];
      }
    }
    return this._publicCohortNamesAndIds;
  }

  public async userCohortNamesAndIds() {
    try {
      this._userCohortNamesAndIds = await getUserCohorts();
    } catch (error) {
      console.warn('🚨 Failed to fetch user cohorts, likely auth not ready:', error);
      this._userCohortNamesAndIds = [];
    }
    return this._userCohortNamesAndIds;
  }

  public async getUserStudies(): Promise<StudyData[]> {
    if (this._userStudies === null) {
      try {
        const studies = await getUserStudies();
        // Assign display_order if missing and sort
        this._userStudies = this.ensureDisplayOrder(studies);
      } catch (error) {
        console.warn('🚨 Failed to fetch user studies, likely auth not ready:', error);
        this._userStudies = [];
      }
    }
    return this._userStudies || [];
  }

  public async getPublicStudies(): Promise<StudyData[]> {
    if (this._publicStudies === null) {
      try {
        const studies = await getPublicStudies();
        // Assign display_order if missing and sort
        this._publicStudies = this.ensureDisplayOrder(studies);
      } catch (error) {
        console.warn('🚨 Failed to fetch public studies, likely auth not ready:', error);
        this._publicStudies = [];
      }
    }
    return this._publicStudies || [];
  }

  public async getCohortsForStudy(study_id: string): Promise<CohortData[]> {
    if (!this._studyCohortsCache.has(study_id)) {
      try {
        const cohorts = await getCohortsForStudy(study_id);

        // Find the study data from cache
        const study = 
          this._userStudies?.find(s => s.id === study_id) || 
          this._publicStudies?.find(s => s.id === study_id);

        // Attach study reference to each cohort
        const cohortsWithStudy = cohorts.map((cohort: any) => ({
          ...cohort,
          study: study
        }));

        // Assign display_order if missing and sort
        const sortedCohorts = this.ensureDisplayOrder<CohortData>(cohortsWithStudy);
        this._studyCohortsCache.set(study_id, sortedCohorts);
      } catch (error) {
        console.warn('🚨 Failed to fetch cohorts for study:', study_id, error);
        this._studyCohortsCache.set(study_id, []);
      }
    }else{
    }
    return this._studyCohortsCache.get(study_id) || [];
  }

  /**
   * Ensure all items have a display_order and sort by it
   * If display_order is missing, assign sequential values
   */
  private ensureDisplayOrder<T extends { id: string; display_order?: number }>(items: T[]): T[] {
    // Assign display_order to items that don't have it
    items.forEach((item, index) => {
      if (item.display_order === undefined || item.display_order === null) {
        item.display_order = index;
      }
    });

    // Sort by display_order
    return items.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
  }

  public async loadUserWorkspace(): Promise<void> {
    
    try {
      // Load all studies first
      const [userStudies, publicStudies] = await Promise.all([
        getUserStudies(),
        getPublicStudies()
      ]);
      
      this._userStudies = userStudies;
      this._publicStudies = publicStudies;
      
      
      // Load cohorts for all studies in parallel
      const allStudies = [...userStudies, ...publicStudies];
      const cohortPromises = allStudies.map(async (study) => {
        const cohorts = await getCohortsForStudy(study.id);
        
        // Attach study reference to each cohort
        const cohortsWithStudy = cohorts.map((cohort: any) => ({
          ...cohort,
          study: study
        }));
        
        this._studyCohortsCache.set(study.id, cohortsWithStudy);
        return { study, cohorts: cohortsWithStudy };
      });
      
      await Promise.all(cohortPromises);
    } catch (error) {
      console.warn('🚨 Failed to load user workspace:', error);
      // Set fallback empty values
      this._userStudies = [];
      this._publicStudies = [];
    }
  }

  public clearStudyCohortsCache(study_id?: string) {
    if (study_id) {
      this._studyCohortsCache.delete(study_id);
    } else {
      this._studyCohortsCache.clear();
    }
  }

  private constructor() {
    this.cohortDataService = CohortDataService.getInstance();
    this.cohortDataService.addNameChangeListener(() => {
      // When cohort data changes, refresh all cached data
      this.invalidateCache();

      this.notifyListeners();
    });
  }

  public static getInstance(): CohortsDataService {
    if (!CohortsDataService.instance) {
      CohortsDataService.instance = new CohortsDataService();
    }
    return CohortsDataService.instance;
  }

  public async createNewStudy() {
    /*
    Creates an in-memory study data structure with optimistic UI updates.
    The UI updates immediately while the database save happens in the background.
    */
    const newStudyData: StudyData = {
      id: createID(),
      name: 'New Study',
      description: 'A new study',
      is_public: false,
      creator_id: '', // Will be set by backend
      visible_by: [],
      display_order: this._userStudies?.length ?? 0,
    };

    // Optimistically add to cache for immediate UI update
    if (this._userStudies === null) {
      // Cache not loaded yet, load it first
      await this.getUserStudies();
    }
    
    if (this._userStudies) {
      this._userStudies.push(newStudyData);
      this.notifyListeners(); // UI updates immediately
    }

    // Save to database in background
    try {
      await createNewStudy(newStudyData);
    } catch (error) {
      console.error('Failed to create study in database:', error);
      // Revert optimistic update on failure
      if (this._userStudies) {
        this._userStudies = this._userStudies.filter(s => s.id !== newStudyData.id);
        this.notifyListeners();
      }
      throw error;
    }
    
    return newStudyData;
  }

  public async createNewCohort(study_id: string) {
    /*
    Creates a new cohort with optimistic UI updates.
    The UI updates immediately while the database save happens in the background.
    */
    const existingCohorts = await this.getCohortsForStudy(study_id);
    
    const newCohortData: CohortData = {
      id: createID(),
      name: 'New Cohort',
      study_id: study_id,
      display_order: existingCohorts.length,
      phenotypes: [],
      database_config: {},
    };

    // Optimistically add to cache for immediate UI update
    const cachedCohorts = this._studyCohortsCache.get(study_id);
    if (cachedCohorts) {
      cachedCohorts.push(newCohortData);
      this.notifyListeners(); // UI updates immediately
    }

    // Save to database in background
    try {
      await updateCohort(newCohortData.id, {
        ...newCohortData,
        class_name: 'Cohort',
        phenotypes: [],
        database_config: {},
      });
    } catch (error) {
      console.error('Failed to create cohort in database:', error);
      // Revert optimistic update on failure
      if (cachedCohorts) {
        const index = cachedCohorts.findIndex(c => c.id === newCohortData.id);
        if (index > -1) {
          cachedCohorts.splice(index, 1);
          this.notifyListeners();
        }
      }
      throw error;
    }
    
    return newCohortData;
  }

  public async updateStudyData(study_id: string, study_data: any) {
    await updateStudy(study_id, study_data);
    
    // Clear cached data to force refresh
    this._userStudies = null;
    this._publicStudies = null;
    this.notifyListeners();
  }

  /**
   * Update display order for multiple studies
   * @param studyOrders Array of {study_id, display_order} tuples
   */
  public async updateStudiesDisplayOrder(studyOrders: Array<{ study_id: string; display_order: number }>) {
    try {
      // Update backend in parallel
      await Promise.all(
        studyOrders.map(({ study_id, display_order }) => 
          updateStudyDisplayOrder(study_id, display_order)
        )
      );

      // Update local cache
      studyOrders.forEach(({ study_id, display_order }) => {
        // Update in user studies if exists
        const userStudy = this._userStudies?.find(s => s.id === study_id);
        if (userStudy) {
          userStudy.display_order = display_order;
        }

        // Update in public studies if exists
        const publicStudy = this._publicStudies?.find(s => s.id === study_id);
        if (publicStudy) {
          publicStudy.display_order = display_order;
        }
      });

      // Re-sort the arrays
      if (this._userStudies) {
        this._userStudies.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      }
      if (this._publicStudies) {
        this._publicStudies.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      }

      this.notifyListeners();
    } catch (error) {
      console.error('Failed to update study display order:', error);
      throw error;
    }
  }

  /**
   * Update display order for multiple cohorts in a study
   * @param study_id The study containing the cohorts
   * @param cohortOrders Array of {cohort_id, display_order} tuples
   */
  public async updateCohortsDisplayOrder(study_id: string, cohortOrders: Array<{ cohort_id: string; display_order: number }>) {
    try {
      // Update backend in parallel
      await Promise.all(
        cohortOrders.map(({ cohort_id, display_order }) => 
          updateCohortDisplayOrder(cohort_id, display_order)
        )
      );

      // Update local cache
      const cohorts = this._studyCohortsCache.get(study_id);
      if (cohorts) {
        cohortOrders.forEach(({ cohort_id, display_order }) => {
          const cohort = cohorts.find(c => c.id === cohort_id);
          if (cohort) {
            cohort.display_order = display_order;
          }
        });

        // Re-sort the array
        cohorts.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      }

      this.notifyListeners();
    } catch (error) {
      console.error('Failed to update cohort display order:', error);
      throw error;
    }
  }

  public invalidateCache() {
    this._publicCohortNamesAndIds = null;
    this._userCohortNamesAndIds = null;
    this._userStudies = null;
    this._publicStudies = null;
    this._studyCohortsCache.clear();
  }

  private listeners: Array<() => void> = [];

  public addListener(listener: () => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: () => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}
