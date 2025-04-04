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
    const cohortData = this.dataService.cohort_data;

    // Validate entry criterion
    if (this.dataService.cohort_data.entry_criterion) {
      const issues = this.validatePhenotype(this.dataService.cohort_data.entry_criterion);
      if (issues.length > 0) {
        this.issues.push({
          id: this.dataService.cohort_data.entry_criterion.id,
          issues: issues,
          phenotype_name: this.dataService.cohort_data.entry_criterion.name,
          type: this.dataService.cohort_data.entry_criterion.type,
          phenotype: this.dataService.cohort_data.entry_criterion,
        });
        this.issueCount += issues.length;
      }
    }

    // Validate arrays of phenotypes
    const phenotypeArrays = [
      { data: this.dataService.cohort_data.inclusions || [], name: 'inclusion' },
      { data: this.dataService.cohort_data.exclusions || [], name: 'exclusion' },
      { data: this.dataService.cohort_data.characteristics || [], name: 'characteristics' },
      { data: this.dataService.cohort_data.outcomes || [], name: 'outcomes' },
    ];

    for (const { data, name } of phenotypeArrays) {
      for (const phenotype of data) {
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
    }

    return {
      issueCount: this.issueCount,
      issues: this.issues,
    };
  }
}
