import { TableData, ColumnDefinition, TableRow } from '../tableTypes';
import { CohortModel } from './CohortModel';
import { CohortIssuesService } from '../CohortIssuesDisplay/CohortIssuesService';
import { ConstantsDataService } from '../../SlideoverPanels/ConstantsPanel/ConstantsDataService';
import { CodelistDataService } from '../../SlideoverPanels/CodelistsViewer/CodelistDataService';
import { ReportDataService } from '../../SlideoverPanels/CohortReportView/ReportDataService';
import { CohortExecutionService } from './CohortExecutionService';

export class CohortDataService {
  private static instance: CohortDataService;
  private _activeCohort: CohortModel;

  private constructor() {
    this._activeCohort = new CohortModel();
  }

  public static getInstance(): CohortDataService {
    if (!CohortDataService.instance) {
      CohortDataService.instance = new CohortDataService();
    }
    return CohortDataService.instance;
  }

  // Allow replacing the backing model if needed (or just updating data)
  public setActiveCohortModel(model: CohortModel) {
      this._activeCohort = model;
  }
  
  public get activeCohort(): CohortModel {
    return this._activeCohort;
  }

  public get cohort_name(): string { return this._activeCohort.cohort_name; }
  public set cohort_name(value: string) { this._activeCohort.cohort_name = value; }

  public get cohort_data(): Record<string, any> { return this._activeCohort.cohort_data; }
  public set cohort_data(value: Record<string, any>) { this._activeCohort.cohort_data = value; }

  public get table_data(): TableData { return this._activeCohort.table_data; }

  public get issues_service(): CohortIssuesService { return this._activeCohort.issues_service; }
  public get constants_service(): ConstantsDataService { return this._activeCohort.constants_service; }
  public get codelists_service(): CodelistDataService { return this._activeCohort.codelists_service; }
  public get report_service(): ReportDataService { return this._activeCohort.report_service; }
  public get execution_service(): CohortExecutionService { return this._activeCohort.execution_service; }

  public getStudyNameForCohort(): string { return this._activeCohort.getStudyNameForCohort(); }
  public tableDataFromCohortData(): TableData { return this._activeCohort.tableDataFromCohortData(); }
  public loadCohortData(cohortData: any): void { return this._activeCohort.loadCohortData(cohortData); }
  public setDatabaseSettings(databaseConfig: any) { return this._activeCohort.setDatabaseSettings(databaseConfig); }
  
  public createEmptyCohortDefaultPhenotypes = () => { return this._activeCohort.createEmptyCohortDefaultPhenotypes(); }

  public setConstants(constants: any) { return this._activeCohort.setConstants(constants); }
  public onCellValueChanged(event: any, selectedRows?: any[]) { return this._activeCohort.onCellValueChanged(event, selectedRows); }
  public saveChangesToCohort(changesToCohort: boolean = true, refreshGrid: boolean = true) { return this._activeCohort.saveChangesToCohort(changesToCohort, refreshGrid); }
  
  public addPhenotype(type: string = 'NA', parentPhenotypeId: string | null = null) { return this._activeCohort.addPhenotype(type, parentPhenotypeId); }
  public getPhenotypeById(id: string): TableRow | undefined { return this._activeCohort.getPhenotypeById(id); }
  public getAllAncestors(phenotypeData: TableRow): TableRow[] { return this._activeCohort.getAllAncestors(phenotypeData); }
  public getAllDescendants(phenotypeId: string): TableRow[] { return this._activeCohort.getAllDescendants(phenotypeId); }
  public deletePhenotype(id: string) { return this._activeCohort.deletePhenotype(id); }
  public updateComponentOrder(parentId: string, reorderedComponents: TableRow[]) { return this._activeCohort.updateComponentOrder(parentId, reorderedComponents); }
  public updateRowOrder(newRowData: TableRow[]) { return this._activeCohort.updateRowOrder(newRowData); }
  public canDropPhenotype(draggedPhenotype: TableRow, targetPhenotype: TableRow, position: 'before' | 'after' | 'inside'): boolean { return this._activeCohort.canDropPhenotype(draggedPhenotype, targetPhenotype, position); }
  public isNewCohortCreation(): boolean { return this._activeCohort.isNewCohortCreation(); }
  public createNewCohort(studyId?: string) { return this._activeCohort.createNewCohort(studyId); }
  
  public addListener(listener: () => void) { return this._activeCohort.addListener(listener); }
  public removeListener(listener: () => void) { return this._activeCohort.removeListener(listener); }
  public addDataChangeListener(listener: () => void) { return this._activeCohort.addDataChangeListener(listener); }
  public removeDataChangeListener(listener: () => void) { return this._activeCohort.removeDataChangeListener(listener); }
  public addExecutionProgressListener(listener: (message: string | any, type: 'log' | 'error' | 'result' | 'complete') => void) { return this._activeCohort.addExecutionProgressListener(listener); }
  public removeExecutionProgressListener(listener: (message: string | any, type: 'log' | 'error' | 'result' | 'complete') => void) { return this._activeCohort.removeExecutionProgressListener(listener); }
  public addNameChangeListener(listener: () => void) { return this._activeCohort.addNameChangeListener(listener); }
  public removeNameChangeListener(listener: () => void) { return this._activeCohort.removeNameChangeListener(listener); }
  
  public updateCohortFromChat(response: any) { return this._activeCohort.updateCohortFromChat(response); }
  public executeCohort(): Promise<void> { return this._activeCohort.executeCohort(); }
  public deleteCohort() { return this._activeCohort.deleteCohort(); }
  public filterType(type: string | string[]): void { return this._activeCohort.filterType(type); }
  public toggleComponentPhenotypes(show: boolean): void { return this._activeCohort.toggleComponentPhenotypes(show); }
  public getShowComponents(): boolean { return this._activeCohort.getShowComponents(); }
  public updateColumns(newColumns: ColumnDefinition[]): void { return this._activeCohort.updateColumns(newColumns); }
  public tableDataForComponentPhenotype(parentPhenotype: any): TableData { return this._activeCohort.tableDataForComponentPhenotype(parentPhenotype); }

  public _setNewPhenotypeDefaultValues(newPhenotype: any) { return this._activeCohort._setNewPhenotypeDefaultValues(newPhenotype); }
}
