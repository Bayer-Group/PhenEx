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

  public get studyData(): Record<string, any> {
    return this._study_data;
  }

  public getCohorts(): any[] {
    return this._study_data.cohorts || [];
  }
}
