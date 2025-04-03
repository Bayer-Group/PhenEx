/**
 * PhenexDirectoryParserService
 *
 * This service is responsible for parsing a PhenEx directory and extracting cohort information
 * from JSON files within the directory. It acts as an intermediary between the low-level
 * directory operations (DirectoryReaderWriterService) and the UI data structure management
 * (HierarchicalLeftPanelDataService).
 *
 * Key responsibilities:
 * 1. Monitors directory changes through DirectoryReaderWriterService
 * 2. Parses JSON files to identify and extract cohort information
 * 3. Maintains a list of cohorts found in the directory
 * 4. Notifies listeners when the directory content changes
 *
 * The service follows the Singleton pattern to ensure consistent directory parsing
 * across the application.
 */

import { DirectoryReaderWriterService } from '../components/LeftPanel/DirectoryReaderWriterService';

type ChangeListener = () => void;

export class PhenexDirectoryParserService {
  private static instance: PhenexDirectoryParserService;
  private directoryService: DirectoryReaderWriterService;
  private changeListeners: ChangeListener[] = [];

  private constructor() {
    this.directoryService = DirectoryReaderWriterService.getInstance();
    this.setupDirectoryListener();
  }

  static getInstance(): PhenexDirectoryParserService {
    if (!PhenexDirectoryParserService.instance) {
      PhenexDirectoryParserService.instance = new PhenexDirectoryParserService();
    }
    return PhenexDirectoryParserService.instance;
  }

  private setupDirectoryListener() {
    this.directoryService.addChangeListener(async () => {
      this.notifyListeners();
    });
  }

  private notifyListeners() {
    this.changeListeners.forEach(listener => listener());
  }

  addListener(listener: ChangeListener) {
    this.changeListeners.push(listener);
  }

  removeListener(listener: ChangeListener) {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  private async parseDirectory() {
    try {
      if (!this.directoryService.getSelectedDirectory()) {
        return [];
      }
      const files = await this.directoryService.getFilenamesInSelectedDirectory();
      return files;
    } catch (error) {
      console.error('Error parsing directory:', error);
      return [];
    }
  }

  async getCohortNames(): Promise<string[]> {
    const files = await this.parseDirectory();
    const cohorts: string[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await this.directoryService.readFile(file);
          const jsonContent = JSON.parse(content);
          if (jsonContent.class_name === 'Cohort') {
            cohorts.push(jsonContent['name']);
          }
        } catch (error) {
          console.error(`Error parsing JSON file ${file}:`, error);
        }
      }
    }

    return cohorts.sort();
  }

  async getDataForAllCohorts(): Promise<Record<string, any>[]> {
    const files = await this.parseDirectory();
    const cohorts: Record<string, any>[] = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await this.directoryService.readFile(file);
          const jsonContent = JSON.parse(content);
          if (jsonContent.class_name === 'Cohort') {
            cohorts.push(jsonContent);
          }
        } catch (error) {
          console.error(`Error parsing JSON file ${file}:`, error);
        }
      }
    }

    return cohorts.sort((a, b) => a.name.localeCompare(b.name));
  }

  async fetchCohortData(cohort_name: string): Promise<Record<string, any>> {
    const allCohortData = await this.getDataForAllCohorts();
    const cohort = allCohortData.find(cohort => cohort.name === cohort_name);
    if (cohort === undefined) {
      return {};
    }
    if ('phenotypes' in cohort) {
      return cohort;
    }

    return this._concatenate_phenotypes(cohort);
  }

  _append_key(phenotypes: Array<Record<string, any>>, settype: string) {
    for (let i = 0; i < phenotypes.length; i++) {
      phenotypes[i].type = settype;
    }
  }

  _concatenate_phenotypes(cohort: dict) {
    cohort.entry_criterion.type = 'entry';
    this._append_key(cohort.inclusions, 'inclusion');
    this._append_key(cohort.exclusions, 'exclusion');
    this._append_key(cohort.characteristics, 'baseline');
    this._append_key(cohort.outcomes, 'outcome');

    cohort.phenotypes = [cohort.entry_criterion].concat(
      cohort.inclusions,
      cohort.exclusions,
      cohort.characteristics,
      cohort.outcomes
    );
    return cohort;
  }

  async deleteCohort(cohortId: string): Promise<void> {
    const files = await this.parseDirectory();
    for (const file of files) {
      if (file === `cohort_${cohortId}.json`) {
        await this.directoryService.deleteFile(file);
        this.notifyListeners();
        break;
      }
    }
  }
}
