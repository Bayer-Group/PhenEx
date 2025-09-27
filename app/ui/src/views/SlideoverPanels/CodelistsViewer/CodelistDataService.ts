import { themeQuartz } from 'ag-grid-community';
import {
  getCodelistFilenamesForCohort,
  getCodelistFileForCohort,
  uploadCodelistFileToCohort,
} from '../../../api/codelists/route';
import { createID } from '../../../types/createID';
import { CohortDataService } from '../../CohortViewer/CohortDataService/CohortDataService';

interface CodelistFile {
  filename: string;
  id?: string;
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
  private cohortDataService: CohortDataService;
  public _filenames: string[] = null;
  private listeners: (() => void)[] = [];
  public files: CodelistFile[] = [];

  private usedCodelists: UsedCodelist[] = [
    {
      class_name: 'Codelist',
      codelist: {
        'ICD-9': ['427.31'],
        'ICD-10': ['I48.0', 'I48.1', 'I48.2', 'I48.91'],
      },
    },
    {
      class_name: 'Codelist',
      codelist: {
        'ICD-9': ['250.00'],
        'ICD-10': ['E11.9'],
      },
    },
    {
      class_name: 'Codelist',
      codelist: {
        'ICD-9': ['401.9'],
        'ICD-10': ['I10'],
      },
    },
  ];

  constructor() {}

  public async setFilenamesForCohort() {
    const oldFilenames = this._filenames;
    const filenames = await getCodelistFilenamesForCohort(this.cohortDataService.cohort_data.id);
    this._filenames = filenames.map(fileinfo => fileinfo.filename);
    this.files = await Promise.all(
      filenames.map(fileinfo =>
        getCodelistFileForCohort(this.cohortDataService.cohort_data.id, fileinfo.id)
      )
    );
    this.notifyListeners();
  }

  public addListener(listener: () => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: () => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  public async setCohortDataService(dataService: CohortDataService) {
    this.cohortDataService = dataService;
    this.cohortDataService.addListener(() => {
      this.setFilenamesForCohort();
    });
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

  public addFile(file: { filename: string; contents: any }): void {
    const csvData = this.parseCSVContents(file.contents);
    console.log("Parsed data", csvData)
    const newFile: CodelistFile = {
      filename: file.filename,
      id: createID(),
      code_column: 'code',
      code_type_column: 'code_type',
      codelist_column: 'codelist',
      contents: csvData,
    };
    console.log("Parsed, files are", this.files)
    this.files.push(newFile);
    this._filenames.push(newFile.filename);
    this.notifyListeners();
    uploadCodelistFileToCohort(this.cohortDataService.cohort_data.id, newFile);
  }

  private parseCSVContents(contents: string): any {
    const lines = contents.split('\n');
    const headers = this.parseCSVLine(lines[0]);

    const data: { [key: string]: string[] } = {};
    headers.forEach(header => {
      data[header] = [];
    });

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = this.parseCSVLine(lines[i]);
      headers.forEach((header, index) => {
        data[header].push(values[index] || '');
      });
    }

    return {
      headers,
      data,
    };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let inQuotes = false;
    let currentValue = '';
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // Handle escaped quotes
          currentValue += '"';
          i += 2;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(currentValue.trim());
        currentValue = '';
        i++;
      } else {
        currentValue += char;
        i++;
      }
    }

    // Push the last field
    result.push(currentValue.trim());
    return result;
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
      fontSize: 11,
      headerBackgroundColor: 'var(--background-color, red)',
      rowBorder: true,
      spacing: 3,
      wrapperBorder: false,
      backgroundColor: 'var(--background-color)',
    });
  }

  public prepareAllCodelistsData() {
    const allHeaders = ['codelist', 'code', 'code_type', 'source'];

    const columnDefs = allHeaders.map(header => ({
      field: header,
      headerName: header.charAt(0).toUpperCase() + header.slice(1).replace(/_/g, ' '),
      width: 100,
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
  }

  public prepareFileData(fileIndex: number) {
    const file = this.files[fileIndex - 1];
    
    // Get special columns that should be pinned to the left
    const specialColumns = [
      file.code_column,
      file.code_type_column,
      file.codelist_column
    ].filter(col => col && file.contents.headers.includes(col));
    
    // Get remaining headers that are not special columns
    const remainingHeaders = file.contents.headers.filter(
      header => !specialColumns.includes(header)
    );
    
    // Create column definitions with special columns first (pinned left)
    const specialColumnDefs = specialColumns.map(header => ({
      field: header,
      headerName: header,
      width: 100,
      pinned: 'left' as const,
    }));
    
    const remainingColumnDefs = remainingHeaders.map(header => ({
      field: header,
      headerName: header,
      width: 100,
    }));
    
    const columnDefs = [...specialColumnDefs, ...remainingColumnDefs];

    const rowData = Array.from(
      { length: file.contents.data[file.contents.headers[0]].length },
      (_, index) => {
        const row: { [key: string]: string } = {};
        file.contents.headers.forEach(header => {
          row[header] = file.contents.data[header][index];
        });
        return row;
      }
    );

    return { columnDefs, rowData };
  }

  public setActiveFile(fileIndex: number) {
    if (fileIndex === 0) {
      this.activeFile = null;
      return;
    }
    this.activeFile = this.files[fileIndex - 1];
  }

  public saveChangesToActiveFile() {
    console.log('saveChangesToActiveFile', this.activeFile);
    uploadCodelistFileToCohort(this.cohortDataService.cohort_data.id, this.activeFile);
  }

  public getColumnsForFile(filename: string) {
    const file = this.files.find(file => file.filename === filename);
    if (!file) return [];
    return file.contents.headers;
  }

  public getFileIdForName(filename: string) {
    const file = this.files.find(file => file.filename === filename);
    if (!file) return null;
    return file.id;
  }

  public getCodelistsForFileInColumn(filename: string, column: string) {
    const file = this.files.find(file => file.filename === filename);
    if (!file) return [];
    const uniqueCodelistNames = Array.from(new Set(file.contents.data[column]));
    return uniqueCodelistNames;
  }

  public getDefaultColumnForFile(filename: string, column: string) {
    const file = this.files.find(file => file.filename === filename);
    if (!file) return null;
    
    switch (column) {
      case 'code_column':
        return file.code_column;
      case 'code_type_column':
        return file.code_type_column;
      case 'codelist_column':
        return file.codelist_column;
      default:
        return null;
    }
  }


  public summarizeCodelistFile(file) {
    if (!file) return [];

    const codelistColumn = file.codelist_column;
    const codeColumn = file.code_column;
    const codeTypeColumn = file.code_type_column;
    const data = file.contents.data;

    // Get unique codelist names
    const uniqueCodelistNames = Array.from(new Set(data[codelistColumn]));

    // Calculate code counts for each codelist
    return uniqueCodelistNames.map(codelistName => {
      // Get indices where this codelist name appears
      const indices = data[codelistColumn]
        .map((name, idx) => (name === codelistName ? idx : -1))
        .filter(idx => idx !== -1);

      // Get codes and their types for these indices
      const codesByType = indices.reduce((acc, idx) => {
        const codeType = data[codeTypeColumn][idx];
        const code = data[codeColumn][idx];
        if (!acc[codeType]) acc[codeType] = new Set();
        acc[codeType].add(code);
        return acc;
      }, {});

      // Calculate total unique codes
      const totalCodes = Object.values(codesByType).reduce(
        (sum, codes: Set<string>) => sum + codes.size,
        0
      );

      return {
        codelist_name: codelistName,
        n_codes: totalCodes,
        filename: file.filename,
      };
    });
  };

  public summarizeAllCodelistFiles() {
    const all_summaries = this.files.map(file => this.summarizeCodelistFile(file));

    const summaries_as_flat_list = all_summaries.flat();
    return summaries_as_flat_list;
  }

}

  