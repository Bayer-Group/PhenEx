import { themeQuartz } from 'ag-grid-community';

interface CodelistFile {
  filename: string;
  code_column: string;
  code_type_column: string;
  codelist_column: string;
  contents: any;
}

interface UsedCodelist {
  class_name: string;
  codelist: {
    [key: string]: string[];
  };
}

export class CodelistDataService {
  private static instance: CodelistDataService;
  private files: CodelistFile[] = [
    {
      filename: 'codes_388.csv',
      code_column: 'concept_id',
      code_type_column: 'vocabulary',
      codelist_column: 'codelist',
      contents: {
        concept_id: ['427.31', 'I48.0', 'I48.1'],
        vocabulary: ['ICD-9', 'ICD-10', 'ICD-10'],
        codelist: ['AF', 'AF', 'AF']
      }
    },
    {
      filename: 'codes_389.csv',
      code_column: 'concept_id',
      code_type_column: 'vocabulary',
      codelist_column: 'codelist',
      contents: {
        concept_id: ['250.00', 'E11.9'],
        vocabulary: ['ICD-9', 'ICD-10'],
        codelist: ['DM', 'DM']
      }
    },
    {
      filename: 'codes_390.csv',
      code_column: 'concept_id',
      code_type_column: 'vocabulary',
      codelist_column: 'codelist',
      contents: {
        concept_id: ['401.9', 'I10'],
        vocabulary: ['ICD-9', 'ICD-10'],
        codelist: ['HTN', 'HTN']
      }
    },
    {
      filename: 'codes_391.csv',
      code_column: 'concept_id',
      code_type_column: 'vocabulary',
      codelist_column: 'codelist',
      contents: {
        concept_id: ['272.0', 'E78.0'],
        vocabulary: ['ICD-9', 'ICD-10'],
        codelist: ['CHOL', 'CHOL']
      }
    }
  ];

  private usedCodelists: UsedCodelist[] = [
    {
      class_name: 'Codelist',
      codelist: {
        'ICD-9': ['427.31'],
        'ICD-10': ['I48.0', 'I48.1', 'I48.2', 'I48.91']
      }
    },
    {
      class_name: 'Codelist',
      codelist: {
        'ICD-9': ['250.00'],
        'ICD-10': ['E11.9']
      }
    },
    {
      class_name: 'Codelist',
      codelist: {
        'ICD-9': ['401.9'],
        'ICD-10': ['I10']
      }
    }
  ];

  private constructor() {}

  public static getInstance(): CodelistDataService {
    if (!CodelistDataService.instance) {
      CodelistDataService.instance = new CodelistDataService();
    }
    return CodelistDataService.instance;
  }

  public getTotalCodes(): number {
    let total = 0;
    this.usedCodelists.forEach(codelist => {
      Object.values(codelist.codelist).forEach(codes => {
        total += codes.length;
      });
    });
    return total;
  }

  public getTotalCodelists(): number {
    return this.usedCodelists.length;
  }

  public setFiles(files: CodelistFile[]): void {
    this.files = files;
  }

  public setUsedCodelists(codelists: UsedCodelist[]): void {
    this.usedCodelists = codelists;
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

}