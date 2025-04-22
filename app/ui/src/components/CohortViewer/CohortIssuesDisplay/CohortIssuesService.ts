import { CohortDataService } from '../CohortDataService/CohortDataService';

interface IssueEntry {
  id: string;
  issues: string[];
}

export class CohortIssuesService {
  private static instance: CohortIssuesService;
  private dataService: CohortDataService;
  private issueCount: number = 0;
  private issues: IssueEntry[] = [];
  private classDefinitions: Record<string, any>;
  private listeners: Array<() => void> = [];

  // private constructor() {

  // }

  public setDataService(dataService: CohortDataService) {
    this.dataService = dataService;
    this.dataService.addListener(() => {
      this.validateCohort();
    });
    this.loadClassDefinitions().then(() => {});
  }

  // public static getInstance(): CohortIssuesService {
  //   if (!CohortIssuesService.instance) {
  //     CohortIssuesService.instance = new CohortIssuesService();
  //   }
  //   return CohortIssuesService.instance;
  // }

  private async loadClassDefinitions() {
    if (this.classDefinitions) {
      return;
    }
    try {
      const response = await fetch('/src/assets/class_definitions.json');
      this.classDefinitions = await response.json();
    } catch (error) {
      console.error('Failed to load class definitions:', error);
    }
  }

  private validatePhenotype(phenotype: any): string[] {
    const missingParams: string[] = [];
    const className = phenotype.class_name;
    if (!this.classDefinitions) {
      return ['Class definitions not loaded yet'];
    }
    if (!className || !this.classDefinitions[className]) {
      return ['Invalid or missing class_name'];
    }

    const requiredParams = this.classDefinitions[className]
      .filter((param: any) => param.required)
      .map((param: any) => param.param);

    for (const paramName of requiredParams) {
      if (!(paramName in phenotype)) {
        missingParams.push(`${paramName} (missing)`);
        phenotype[paramName] = 'missing';
        continue;
      }
      const paramValue = phenotype[paramName];
      if (
        paramValue === null ||
        paramValue === undefined ||
        paramValue === 'missing' ||
        (Array.isArray(paramValue) && paramValue.length === 0)
      ) {
        missingParams.push(`${paramName}`);
        phenotype[paramName] = 'missing';
      }
    }
    return missingParams;
  }

  public validateCohort() {
    this.issues = [];
    this.issueCount = 0;

    for (const phenotype of this.dataService.cohort_data.phenotypes || []) {
      const issues = this.validatePhenotype(phenotype);
      if (issues.length > 0) {
        this.issues.push({
          id: phenotype.id,
          issues: issues,
          phenotype_name: phenotype.name,
          type: phenotype.type,
          phenotype: phenotype,
        });
        this.issueCount += issues.length;
      }
    }
    console.log('VALIDATION ISSUES', this.issues);
    this.notifyListeners();
    return {
      issueCount: this.issueCount,
      issues: this.issues,
    };
  }

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
