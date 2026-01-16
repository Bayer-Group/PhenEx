import { themeQuartz } from 'ag-grid-community';
import {
  getCodelistFilenamesForCohort,
  getCodelistFileForCohort,
  uploadCodelistFileToCohort,
  updateCodelistFileColumnMapping,
} from '../../../api/codelists/route';
import { createID } from '../../../types/createID';
import { CohortModel } from '../../CohortViewer/CohortDataService/CohortModel';

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

interface FileMetadata {
  id: string;
  filename: string;
  codelists: string[];
  code_column?: string;
  code_type_column?: string;
  codelist_column?: string;
}

interface CodelistCache {
  filename: string;
  mapping: {
    code_column: string;
    code_type_column: string;
    codelist_column: string;
  };
  codelists: string[];
}

export class CodelistDataService {
  public activeFile: CodelistFile | null = null;
  private cohortDataService!: CohortModel;
  public _filenames: string[] | null = null;
  private listeners: (() => void)[] = [];
  public files: CodelistFile[] = [];
  private filesMetadata: FileMetadata[] = [];
  private readonly CACHE_KEY = 'phenex_codelist_cache';

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

  // LocalStorage cache methods
  private getCacheKey(cohortId: string): string {
    return `${this.CACHE_KEY}_${cohortId}`;
  }

  private getCodelistCache(cohortId: string): CodelistCache[] {
    try {
      const cached = localStorage.getItem(this.getCacheKey(cohortId));
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Failed to read codelist cache:', error);
      return [];
    }
  }

  private setCodelistCache(cohortId: string, cache: CodelistCache[]): void {
    try {
      localStorage.setItem(this.getCacheKey(cohortId), JSON.stringify(cache));
    } catch (error) {
      console.error('Failed to write codelist cache:', error);
    }
  }

  private updateCacheForFile(cohortId: string, filename: string, mapping: any, codelists: string[]): void {
    const cache = this.getCodelistCache(cohortId);
    const existingIndex = cache.findIndex(c => c.filename === filename);
    
    const newEntry: CodelistCache = {
      filename,
      mapping: {
        code_column: mapping.code_column,
        code_type_column: mapping.code_type_column,
        codelist_column: mapping.codelist_column
      },
      codelists
    };

    if (existingIndex >= 0) {
      cache[existingIndex] = newEntry;
    } else {
      cache.push(newEntry);
    }

    this.setCodelistCache(cohortId, cache);
  }

  private getCodelistsFromCache(cohortId: string, filename: string, column: string): string[] | null {
    const cache = this.getCodelistCache(cohortId);
    const entry = cache.find(c => c.filename === filename);
    
    if (!entry) {
      return null;
    }

    // Check if the requested column matches the cached mapping
    if (entry.mapping.codelist_column === column) {
      return entry.codelists;
    }

    return null;
  }

  public async setFilenamesForCohort() {
    const cohortId = this.cohortDataService.cohort_data.id;
    
    
    // If we already have filenames loaded for this cohort, skip the backend call
    if (this._filenames && this._filenames.length > 0) {
      return;
    }
    
    // Fetch metadata from backend (lightweight call)
    const filenames = await getCodelistFilenamesForCohort(cohortId);
    
    // Store the metadata (including cached codelists array) separately
    // This allows us to avoid loading full file contents when we just need codelist names
    this.filesMetadata = filenames.map((fileinfo: any) => ({
      id: fileinfo.id,
      filename: fileinfo.filename.startsWith('"') && fileinfo.filename.endsWith('"') 
        ? fileinfo.filename.slice(1, -1) 
        : fileinfo.filename,
      codelists: fileinfo.codelists || [],
      code_column: fileinfo.code_column,
      code_type_column: fileinfo.code_type_column,
      codelist_column: fileinfo.codelist_column
    }));
    
    // Update localStorage cache with data from backend
    this.filesMetadata.forEach(meta => {
      if (meta.codelists && meta.codelists.length > 0 && meta.codelist_column) {
        this.updateCacheForFile(
          cohortId,
          meta.filename,
          {
            code_column: meta.code_column,
            code_type_column: meta.code_type_column,
            codelist_column: meta.codelist_column
          },
          meta.codelists
        );
      }
    });
    
    // Remove any surrounding quotes from filenames
    this._filenames = this.filesMetadata.map(meta => meta.filename);
    
    // OPTIMIZATION: Only load full file contents if we don't have them in cache
    // This is the SLOW part that we want to avoid
    const filesToLoad = filenames.filter((fileinfo: any) => {
      const filename = fileinfo.filename.startsWith('"') && fileinfo.filename.endsWith('"') 
        ? fileinfo.filename.slice(1, -1) 
        : fileinfo.filename;
      const existingFile = this.files.find(f => f.filename === filename);
      return !existingFile; // Only load if we don't have it already
    });
    
    if (filesToLoad.length > 0) {
      const filePromises = await Promise.all(
        filesToLoad.map((fileinfo: any) =>
          getCodelistFileForCohort(this.cohortDataService.cohort_data.id, fileinfo.id)
        )
      );
      
      // Filter out any undefined/null results and add to existing files
      const newFiles = filePromises.filter(file => file && file.contents && file.contents.data);
      this.files = [...this.files, ...newFiles];
    } else {
    }
    
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

  public async setCohortDataService(dataService: CohortModel) {
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
    const newFile: CodelistFile = {
      filename: file.filename,
      id: createID(),
      code_column: 'code',
      code_type_column: 'code_type',
      codelist_column: 'codelist',
      contents: csvData,
    };
    this.files.push(newFile);
    if (!this._filenames) this._filenames = [];
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
    uploadCodelistFileToCohort(this.cohortDataService.cohort_data.id, this.activeFile);
  }

  public async saveColumnMappingForActiveFile() {
    if (!this.activeFile || !this.activeFile.id) {
      console.error('No active file or file ID to save column mapping');
      return;
    }

    const columnMapping = {
      code_column: this.activeFile.code_column,
      code_type_column: this.activeFile.code_type_column,
      codelist_column: this.activeFile.codelist_column,
    };

    try {
      const response = await updateCodelistFileColumnMapping(this.activeFile.id, columnMapping);
      
      // Update localStorage cache with new codelists from backend response
      if (response && response.codelists) {
        const cohortId = this.cohortDataService.cohort_data.id;
        this.updateCacheForFile(
          cohortId,
          this.activeFile.filename,
          columnMapping,
          response.codelists
        );
      }
      
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save column mapping:', error);
    }
  }

  public getColumnsForFile(filename: string) {
    
    // Remove quotes if they exist in the search filename
    let searchFilename = filename;
    if (searchFilename.startsWith('"') && searchFilename.endsWith('"')) {
      searchFilename = searchFilename.slice(1, -1);
    }
    
    const file = this.files.find(file => file.filename === searchFilename);
    if (!file) {
      return [];
    }
    
    return file.contents?.headers || [];
  }

  public getFileIdForName(filename: string) {
    const file = this.files.find(file => file.filename === filename);
    if (!file) return null;
    return file.id;
  }

  public getCodelistsForFileInColumn(filename: string, column: string) {
    const cohortId = this.cohortDataService.cohort_data.id;
    
    // Remove quotes if they exist in the search filename
    let searchFilename = filename;
    if (searchFilename.startsWith('"') && searchFilename.endsWith('"')) {
      searchFilename = searchFilename.slice(1, -1);
    }
    
    // STEP 1: Check localStorage cache first (fastest)
    const cachedCodelists = this.getCodelistsFromCache(cohortId, searchFilename, column);
    if (cachedCodelists) {
      return cachedCodelists;
    }
    // STEP 2: Check in-memory metadata from backend (fast, avoids loading full file)
    const metadata = this.filesMetadata.find(meta => meta.filename === searchFilename);
    if (metadata) {
      
      // If the column matches the stored codelist_column, use cached codelists array
      if (metadata.codelist_column === column && metadata.codelists && metadata.codelists.length > 0) {
        // Store to localStorage for next time
        this.updateCacheForFile(
          cohortId,
          searchFilename,
          {
            code_column: metadata.code_column,
            code_type_column: metadata.code_type_column,
            codelist_column: metadata.codelist_column
          },
          metadata.codelists
        );
        return metadata.codelists;
      }
    }
    // STEP 3: Fall back to loading full file data if column doesn't match or cache is empty (slow)
    
    const file = this.files.find(file => file.filename === searchFilename);
    if (!file) {
      return [];
    }
    
    
    if (!file.contents?.data || !file.contents.data[column]) {
      return [];
    }
    
    const uniqueCodelistNames = Array.from(new Set(file.contents.data[column]));
    // Store the result in localStorage for next time
    this.updateCacheForFile(
      cohortId,
      searchFilename,
      {
        code_column: file.code_column,
        code_type_column: file.code_type_column,
        codelist_column: column
      },
      uniqueCodelistNames
    );
    
    return uniqueCodelistNames;
  }

  public getDefaultColumnForFile(filename: string, column: string) {
    
    // Remove quotes if they exist in the search filename
    let searchFilename = filename;
    if (searchFilename.startsWith('"') && searchFilename.endsWith('"')) {
      searchFilename = searchFilename.slice(1, -1);
    }
    
    const file = this.files.find(file => file.filename === searchFilename);
    if (!file) {
      return null;
    }
    
    
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


  public summarizeCodelistFile(file: CodelistFile) {
    if (!file) return [];
    if (!file.contents || !file.contents.data) {
      console.warn('File missing contents or data:', file);
      return [];
    }

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
        .map((name: string, idx: number) => (name === codelistName ? idx : -1))
        .filter((idx: number) => idx !== -1);

      // Get codes and their types for these indices
      const codesByType = indices.reduce((acc: Record<string, Set<string>>, idx: number) => {
        const codeType = data[codeTypeColumn][idx];
        const code = data[codeColumn][idx];
        if (!acc[codeType]) acc[codeType] = new Set();
        acc[codeType].add(code);
        return acc;
      }, {});

      // Calculate total unique codes
      const totalCodes = Object.values(codesByType).reduce(
        (sum: number, codes: Set<string>) => sum + codes.size,
        0
      );

      return {
        codelist_name: codelistName,
        n_codes: totalCodes,
        filename: file.filename,
      };
    });
  }

  public summarizeAllCodelistFiles() {
    const all_summaries = this.files.map(file => this.summarizeCodelistFile(file));

    const summaries_as_flat_list = all_summaries.flat();
    return summaries_as_flat_list;
  }

}

  