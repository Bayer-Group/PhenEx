import { createID } from '../../types/createID';
import { 
  getPublicCohorts, 
  getUserCohorts, 
  updateCohort,
  getUserStudies,
  getPublicStudies,
  getCohortsForStudy,
  createNewStudy,
  updateStudy
} from '../../api/text_to_cohort/route';
import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';

export interface StudyData {
  id: string;
  name: string;
  description?: string;
  is_public: boolean;
  creator_id: string;
  visible_by: string[];
}

export interface CohortData {
  id: string;
  name: string;
  study_id: string;
  parent_cohort_id?: string;
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
        this._userStudies = await getUserStudies();
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
        this._publicStudies = await getPublicStudies();
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
        this._studyCohortsCache.set(study_id, cohorts);
      } catch (error) {
        console.warn('🚨 Failed to fetch cohorts for study:', study_id, error);
        this._studyCohortsCache.set(study_id, []);
      }
    }
    return this._studyCohortsCache.get(study_id) || [];
  }

  public async loadUserWorkspace(): Promise<void> {
    console.log('🏗️ Loading complete user workspace...');
    
    try {
      // Load all studies first
      const [userStudies, publicStudies] = await Promise.all([
        getUserStudies(),
        getPublicStudies()
      ]);
      
      this._userStudies = userStudies;
      this._publicStudies = publicStudies;
      
      console.log(`🏗️ Loaded ${userStudies.length} user studies and ${publicStudies.length} public studies`);
      
      // Load cohorts for all studies in parallel
      const allStudies = [...userStudies, ...publicStudies];
      const cohortPromises = allStudies.map(async (study) => {
        const cohorts = await getCohortsForStudy(study.id);
        this._studyCohortsCache.set(study.id, cohorts);
        console.log(`🏗️ Loaded ${cohorts.length} cohorts for study "${study.name}"`);
        return { study, cohorts };
      });
      
      await Promise.all(cohortPromises);
      console.log('🏗️ User workspace loading complete!');
      console.log(this._studyCohortsCache);
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
    Creates an in-memory study data structure. This is saved immediately.
    */
    const newStudyData = {
      id: createID(),
      name: 'New Study',
      description: 'A new study',
      baseline_characteristics: {},
      outcomes: {},
      analysis: {},
      visible_by: [],
      is_public: false,
    };

    await createNewStudy(newStudyData);
    
    // Clear cached data to force refresh
    this._userStudies = null;
    this.notifyListeners();
    return newStudyData;
  }

  public async createNewCohort(study_id: string) {
    /*
    Creates an in memory cohort (empty) data structure new cohort. This is not saved to disk! only when user inputs any changes to the cohort are changes made
    */
    const newCohortData = {
      id: createID(),
      name: 'New Cohort',
      class_name: 'Cohort',
      study_id: study_id,
      phenotypes: [],
      database_config: {},
    };

    await updateCohort(newCohortData.id, newCohortData);

    // Clear cached cohorts for this study
    this.clearStudyCohortsCache(study_id);
    this.notifyListeners(); // Notify listeners after initialization
    return newCohortData;
  }

  public async updateStudyData(study_id: string, study_data: any) {
    await updateStudy(study_id, study_data);
    
    // Clear cached data to force refresh
    this._userStudies = null;
    this._publicStudies = null;
    this.notifyListeners();
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
