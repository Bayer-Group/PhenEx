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

  private constructor() {
    this.dataService = CohortDataService.getInstance();
    this.loadClassDefinitions();
  }

  public static getInstance(): CohortIssuesService {
    if (!CohortIssuesService.instance) {
      CohortIssuesService.instance = new CohortIssuesService();
    }
    return CohortIssuesService.instance;
  }

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

  private async validatePhenotype(phenotype: any): string[] {
    const missingParams: string[] = [];
    const className = phenotype.class_name;
    await this.loadClassDefinitions();
    console.log('HELLO', className);
    console.log(this.classDefinitions);
    console.log(this.classDefinitions[className]);
    if (!className || !this.classDefinitions[className]) {
      return ['Invalid or missing class_name'];
    }

    const requiredParams = this.classDefinitions[className]
      .filter((param: any) => param.required)
      .map((param: any) => param.param);

    for (const paramName of requiredParams) {
      const paramValue = phenotype[paramName];
      if (
        paramValue === null ||
        paramValue === undefined ||
        (Array.isArray(paramValue) && paramValue.length === 0)
      ) {
        missingParams.push(`${paramName}`);
      }
    }

    return missingParams;
  }

  public validateCohort() {
    this.issues = [];
    this.issueCount = 0;
    const cohortData = this.dataService.cohort_data;

    // Validate entry criterion
    if (cohortData.entry_criterion) {
      console.log('LOOKING AT ENTRy CRITERION', cohortData.entry_criterion);
      const issues = this.validatePhenotype(cohortData.entry_criterion);
      console.log('ISSUES ARE', issues);
      if (issues.length > 0) {
        this.issues.push({
          id: cohortData.entry_criterion.id,
          issues: issues,
          phenotype_name: cohortData.entry_criterion.name,
          type: cohortData.entry_criterion.type,
        });
        this.issueCount += issues.length;
      }
    }

    // Validate arrays of phenotypes
    const phenotypeArrays = [
      { data: cohortData.inclusions || [], name: 'inclusion' },
      { data: cohortData.exclusions || [], name: 'exclusion' },
      { data: cohortData.characteristics || [], name: 'characteristics' },
      { data: cohortData.outcomes || [], name: 'outcomes' },
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
          });
          this.issueCount += issues.length;
        }
      }
    }

    console.log(`Found ${this.issueCount} issues:`, this.issues);
    return {
      issueCount: this.issueCount,
      issues: this.issues,
    };
  }
}
