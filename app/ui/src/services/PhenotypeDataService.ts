import { themeQuartz } from 'ag-grid-community';
import classDefinitions from '../assets/class_definitions.json';

export interface Phenotype {
  name: string;
  description?: string;
  id?: string;
  class_name?: string;
  type?: string;
  [key: string]: any;
}

export interface ParamRow {
  parameter: string;
  value: string;
}

export class PhenotypeDataService {
  private static instance: PhenotypeDataService;
  private currentPhenotype: Phenotype | null = null;
  public rowData: ParamRow[] = [
    { parameter: 'Name', value: 'No phenotype selected' },
    { parameter: 'Type', value: 'Not set' },
    { parameter: 'Description', value: 'Not set' }
  ];
  private listeners: (() => void)[] = [];

  private constructor() {}

  public static getInstance(): PhenotypeDataService {
    if (!PhenotypeDataService.instance) {
      PhenotypeDataService.instance = new PhenotypeDataService();
    }
    return PhenotypeDataService.instance;
  }

  public getColumnDefs() {
    return [
      { field: 'parameter', headerName: 'Parameter', sortable: true, filter: true },
      { field: 'value', headerName: 'Value', sortable: true, filter: true },
    ];
  }

  public getTheme() {
    return themeQuartz.withParams({
      accentColor: '#DDDDDD',
      borderColor: '#AFAFAF26',
      browserColorScheme: 'light',
      columnBorder: true,
      headerFontSize: 11,
      headerRowBorder: true,
      cellHorizontalPadding: 10,
      headerBackgroundColor: 'var(--background-color-content, #FFFFFF)',
      rowBorder: true,
      spacing: 8,
      wrapperBorder: false,
    });
  }

  public setData(data: Phenotype | undefined) {
    console.log("SETIG DATA")
    this.currentPhenotype = data || null;
    this.updateRowData();
    this.notifyListeners();
  }

  public getData(): Phenotype | null {
    return this.currentPhenotype;
  }

  public getRowData(): ParamRow[] {
    return this.rowData;
  }

  private updateRowData() {
    if (this.currentPhenotype?.class_name && classDefinitions[this.currentPhenotype.class_name]) {
      const paramDefinitions = classDefinitions[this.currentPhenotype.class_name];
      this.rowData = paramDefinitions.map(paramDef => ({
        parameter: paramDef.param,
        value: this.currentPhenotype![paramDef.param]?.toString() || paramDef.default?.toString() || 'Not set',
      }));
    } else {
      this.rowData = [];
    }
  }

  public addListener(listener: () => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: () => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners() {
    console.log("NOTIFYING LISTENERS", this.listeners)
    this.listeners.forEach(listener => listener());
  }

  public formatType(): string {
    if (!this.currentPhenotype?.type) return '';

    switch (this.currentPhenotype.type) {
      case 'entry':
        return 'Entry Criterion in Pacific AF ECA';
      case 'inclusion':
        return 'Inclusion Criterion in Pacific AF ECA';
      case 'exclusion':
        return 'Inclusion Criterion in Pacific AF ECA';
      case 'baseline':
        return 'Baseline Characteristics in Pacific AF ECA';
      case 'outcome':
        return 'Outcome in Pacific AF ECA';
      default:
        return '';
    }
  }
}