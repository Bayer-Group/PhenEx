import { createID } from '../../types/createID';
import { getCohorts } from '../../api/text_to_cohort/route';

export class CohortsDataService {
  private static instance: CohortsDataService;
  private _cohortNamesAndIds = null;

  public async cohortNamesAndIds() {
    if (this._cohortNamesAndIds === null) {
      this._cohortNamesAndIds = await getCohorts();
    }
    console.log('cohortNamesAndIds', this._cohortNamesAndIds);
    return this._cohortNamesAndIds;
  }

  private constructor() {}

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
      name: 'Name your cohort...',
      class_name: 'Cohort',
      phenotypes: [
        {
          id: createID(),
          type: 'entry',
          name: 'Entry criterion',
          class_name: 'CodelistPhenotype',
        },
      ],
      database_config: {},
    };
    this.notifyListeners(); // Notify listeners after initialization
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
    console.log('DAT ASERVIC IS NOTIFYIN');
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
