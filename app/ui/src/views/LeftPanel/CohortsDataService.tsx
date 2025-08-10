import { createID } from '../../types/createID';
import { getPublicCohorts, getUserCohort, getUserCohorts, updateCohort} from '../../api/text_to_cohort/route';
import { CohortDataService } from '../CohortViewer/CohortDataService/CohortDataService';

export class CohortsDataService {
  private static instance: CohortsDataService;
  private _publicCohortNamesAndIds = null;
  private _userCohortNamesAndIds = null;

  private cohortDataService: CohortDataService;

  public async publicCohortNamesAndIds() {
    if (this._publicCohortNamesAndIds === null) {
      this._publicCohortNamesAndIds = await getPublicCohorts();
    }
    return this._publicCohortNamesAndIds;
  }

  public async userCohortNamesAndIds() {
    if (this._userCohortNamesAndIds === null) {
      this._userCohortNamesAndIds = await getUserCohorts();
    }
    return this._userCohortNamesAndIds;
  }

  private constructor() {
    this.cohortDataService = CohortDataService.getInstance();
    this.cohortDataService.addNameChangeListener(() => {
      // When cohort data changes, refresh the cohort names and IDs
      this._publicCohortNamesAndIds = null;
      this.publicCohortNamesAndIds();
      this._userCohortNamesAndIds = null;
      this.userCohortNamesAndIds();

      this.notifyListeners();
    });
  }

  public static getInstance(): CohortsDataService {
    if (!CohortsDataService.instance) {
      CohortsDataService.instance = new CohortsDataService();
    }
    return CohortsDataService.instance;
  }

  public async createNewCohort() {
    /*
    Creates an in memory cohort (empty) data structure new cohort. This is not saved to disk! only when user inputs any changes to the cohort are changes made
    */
    const newCohortData = {
      id: createID(),
      name: 'New Cohort',
      class_name: 'Cohort',
      phenotypes: [
      ],
      database_config: {},
    };


    const newcohort = await updateCohort(newCohortData.id, newCohortData);

    this.notifyListeners(); // Notify listeners after initialization
    return newCohortData
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

  async deleteCohort() {
    if (this._cohort_data.id) {
      await deleteCohort(this._cohort_data.id);
      this._cohort_data = {};
      this._cohort_name = '';
      this._table_data = { rows: [], columns: this.columns };
      this.notifyListeners();
    }
  }
}
