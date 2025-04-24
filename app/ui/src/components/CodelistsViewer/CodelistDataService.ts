import { themeQuartz } from 'ag-grid-community';

interface CodelistFile {
  filename: string;
  code_column: string;
  code_type_column: string;
  codelist_column: string;
  contents: {
    headers: string[];
    data: { [key: string]: string[] };
  };
}

interface UsedCodelist {
  class_name: string;
  codelist: {
    [key: string]: string[];
  };
}

export class CodelistDataService {
  public activeFile: CodelistFile | null = null;
  public files: CodelistFile[] = [
    {
      filename: 'codes_388.csv',
      code_column: 'code',
      code_type_column: 'code_type',
      codelist_column: 'codelist',
      contents: {
        headers: ['code', 'code_type', 'codelist', 'description', 'source'],
        data: {
          code: ['427.31', 'I48.0', 'I48.1'],
          code_type: ['ICD-9', 'ICD-10', 'ICD-10'],
          codelist: ['AF', 'AF', 'AF'],
          description: ['Atrial Fibrillation', 'Atrial Fibrillation', 'Atrial Flutter'],
          source: ['Manual', 'Manual', 'Manual']
        }
      }
    },
    {
      filename: 'codes_389.csv',
      code_column: 'code',
      code_type_column: 'code_type',
      codelist_column: 'codelist',
      contents: {
        headers: ['code', 'code_type', 'codelist', 'category', 'status'],
        data: {
          code: ['250.00', 'E11.9'],
          code_type: ['ICD-9', 'ICD-10'],
          codelist: ['DM', 'DM'],
          category: ['Type 2', 'Type 2'],
          status: ['Active', 'Active']
        }
      }
    },
    {
      filename: 'codes_390.csv',
      code_column: 'code',
      code_type_column: 'code_type',
      codelist_column: 'codelist',
      contents: {
        headers: ['code', 'code_type', 'codelist', 'severity'],
        data: {
          code: ['401.9', 'I10'],
          code_type: ['ICD-9', 'ICD-10'],
          codelist: ['HTN', 'HTN'],
          severity: ['Unspecified', 'Unspecified']
        }
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

  constructor() {}

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

  public addFile(file: { filename: string; contents: any }): void {
    const csvData = this.parseCSVContents(file.contents);
    const newFile: CodelistFile = {
      filename: file.filename,
      code_column: 'code',
      code_type_column: 'code_type',
      codelist_column: 'codelist',
      contents: csvData
    };
    this.files.push(newFile);
  }

  private parseCSVContents(contents: string): any {
    const lines = contents.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const data: { [key: string]: string[] } = {};
    headers.forEach(header => {
      data[header] = [];
    });

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim());
      headers.forEach((header, index) => {
        data[header].push(values[index]);
      });
    }

    return {
      headers,
      data
    };
  }

  public setUsedCodelists(codelists: UsedCodelist[]): void {
    this.usedCodelists = codelists;
  }

  public getTheme() {
    return themeQuartz.withParams({
      accentColor: '#DDDDDD',
      borderColor: 'var(--line-color-grid)',
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

  public prepareAllCodelistsData() {

    const allHeaders = ['codelist', 'code', 'code_type', 'source']

    const columnDefs = allHeaders.map(header => ({
      field: header,
      headerName: header.charAt(0).toUpperCase() + header.slice(1).replace(/_/g, ' '),
      width: 100
    }));

    const rowData = this.files.flatMap(file => {
      const dataLength = file.contents.data[file.contents.headers[0]].length;
      return Array.from({ length: dataLength }, (_, index) => {
        const row: { [key: string]: string } = {};
        Array.from(allHeaders).forEach(header => {
          if (header === 'source') {
            row[header] = file.filename;
          } else {
            row[header] = file.contents.data[header]?.[index] || '';
          }
        });
        return row;
      });
    });

    return { columnDefs, rowData };
  };

  public prepareFileData(fileIndex: number){
    const file = this.files[fileIndex - 1];
    const columnDefs = file.contents.headers.map(header => ({
      field: header,
      headerName: header,
      width: 100
    }));

    const rowData = Array.from({ length: file.contents.data[file.contents.headers[0]].length }, (_, index) => {
      const row: { [key: string]: string } = {};
      file.contents.headers.forEach(header => {
        row[header] = file.contents.data[header][index];
      });
      return row;
    });

    return { columnDefs, rowData };
  };

  public setActiveFile(fileIndex: number){
    if (fileIndex === 0) {
      this.activeFile = null;
      return;
    }
    this.activeFile = this.files[fileIndex - 1];
  }

}