import { TableData, ColumnDefinition } from '../../CohortViewer/tableTypes';
import { themeQuartz } from 'ag-grid-community';

import { ConstantsCellRenderer } from './ConstantsCellRenderer';
import { ConstantsCellEditorSelector } from './ConstantsCellEditorSelector';
import { ConstantTypeSelectorCellEditor } from './ConstantTypeSelectorCellEditor';
import {
  getStudyConstants,
  createConstant,
  updateConstant,
  deleteConstant,
} from '../../../api/text_to_cohort/route';
import { StudyDataService } from '../../StudyViewer/StudyDataService';

const defaultColumns: ColumnDefinition[] = [
  {
    field: 'name',
    headerName: 'Name',
    width: 200,
    editable: true,
  },

  {
    field: 'type',
    headerName: 'Type',
    editable: true,
    wrapText: false,
    width: 180,
    cellEditorPopup: true,
    cellEditor: ConstantTypeSelectorCellEditor,
  },
  {
    field: 'value',
    headerName: 'Value',
    editable: true,
    minWidth: 0,
    flex: 1,
    cellEditorPopup: true,
    cellRenderer: ConstantsCellRenderer,
    cellEditor: ConstantsCellEditorSelector,
    valueParser: params => params.newValue,
    valueSetter: params => {
      params.data.value = params.newValue;
      return true;
    },
  },
];

interface Constant {
  id?: string;
  name: string;
  description: string;
  type: string;
  value: any;
  index?: number;
}

export class ConstantsDataService {
  private cohortDataService: any;
  private columns: ColumnDefinition[] = defaultColumns;
  public tableData: TableData = {
    rows: [],
    columns: this.columns,
  };
  private listeners: Array<() => void> = [];
  private studyConstants: Constant[] = []; // Store study-level constants separately
  
  private lastLoadedStudyId: string | null = null;
  private pendingEditConstantId: string | null = null; // ID of constant that should be edited

  constructor() {}

  public setCohortDataService(dataService: any) {
    this.cohortDataService = dataService;
    this.loadConstantsFromBackend();
  }

  private getStudyId(): string | null {
    return StudyDataService.getInstance().study_data?.id || null;
  }

  private async loadConstantsFromBackend() {
    const studyId = this.getStudyId();
    if (!studyId) {
      console.warn('[ConstantsDataService] No study_id available, cannot load constants');
      return;
    }
    
    // Avoid reloading if we just loaded for this study
    if (studyId === this.lastLoadedStudyId) {
      return;
    }
    
    try {
      const constants = await getStudyConstants(studyId);
      this.studyConstants = constants.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        type: c.type,
        value: c.value,
        index: c.display_order,
      }));
      this.lastLoadedStudyId = studyId;
      this.tableData = this.tableDataFromConstants();
      this.notifyListeners();
    } catch (error) {
      console.error('[ConstantsDataService] Failed to load constants from backend:', error);
    }
  }

  public async refreshConstants() {
    // If study_id changed or we haven't loaded constants yet, reload from backend
    const studyId = this.getStudyId();
    if (studyId && studyId !== this.lastLoadedStudyId) {
      await this.loadConstantsFromBackend();
      return;
    }
    
    this.tableData = this.tableDataFromConstants();
    this.notifyListeners();
  }

  public addListener(listener: () => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: () => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  public getPendingEditConstantId(): string | null {
    return this.pendingEditConstantId;
  }

  public clearPendingEditConstantId(): void {
    this.pendingEditConstantId = null;
  }

  public getConstantById(id: string): Constant | null {
    return this.studyConstants.find(c => c.id === id) || null;
  }

  public getActualIndexOfConstant(id: string): number {
    return this.studyConstants.findIndex(c => c.id === id);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
    // Also notify cohort listeners to update UI
    if (this.cohortDataService) {
      this.cohortDataService.notifyAllListeners();
    }
  }

  public async addConstant() {
    const studyId = this.getStudyId();
    if (!studyId) {
      console.error('[ConstantsDataService] Cannot add constant: no study_id available');
      return;
    }
    
    const newConst: Constant = {
      name: 'new_constant_' + Math.floor(Math.random() * 1000),
      description: '',
      type: 'DateFilter',
      value: { class_name: 'DateRangeFilter', min_date: null, max_date: null, type: 'date_range' },
      index: this.studyConstants.length,
    };
    
    try {
      const created = await createConstant(studyId, {
        name: newConst.name,
        description: newConst.description,
        type: newConst.type,
        value: newConst.value,
        display_order: newConst.index,
      });
      
      // Add to local state with backend ID
      newConst.id = created.id;
      this.studyConstants.push(newConst);
      this.refreshConstants();
    } catch (error) {
      console.error('[ConstantsDataService] Failed to create constant:', error);
    }
  }

  public async addConstantOfType(type: string, defaultConstantValue: any): Promise<Constant | null> {
    const studyId = this.getStudyId();
    if (!studyId) {
      console.error('[ConstantsDataService] Cannot add constant: no study_id available');
      return null;
    }
    
    const existingOfType = this.studyConstants.filter((c: any) => c.type === type);
    const maxIndex =
      existingOfType.length === 0
        ? -1
        : Math.max(...existingOfType.map((c: any) => (typeof c.index === 'number' ? c.index : -1)));
    
    const newConst: Constant = {
      name: 'new_' + type.toLowerCase() + '_' + Math.floor(Math.random() * 1000),
      description: '',
      type,
      value: defaultConstantValue,
      index: maxIndex + 1,
    };
    
    try {
      const created = await createConstant(studyId, {
        name: newConst.name,
        description: newConst.description,
        type: newConst.type,
        value: newConst.value,
        display_order: newConst.index,
      });
      
      // Add to local state with backend ID
      newConst.id = created.id;
      this.studyConstants.push(newConst);
      
      // Mark this constant for editing
      this.pendingEditConstantId = created.id;
      
      this.refreshConstants();
      return newConst;
    } catch (error) {
      console.error('[ConstantsDataService] Failed to create constant:', error);
      return null;
    }
  }

  public async deleteConstant(name: string) {
    const studyId = this.getStudyId();
    if (!studyId) {
      console.error('[ConstantsDataService] Cannot delete constant: no study_id available');
      return;
    }
    
    const constantToDelete = this.studyConstants.find((c: any) => c.name === name);
    if (!constantToDelete) return;
    
    this.studyConstants = this.studyConstants.filter((c: any) => c.name !== name);
    this.refreshConstants();

    if (constantToDelete.id) {
      try {
        await deleteConstant(studyId, constantToDelete.id);
      } catch (error) {
        console.error('[ConstantsDataService] Failed to delete constant from backend:', error);
      }
    }
  }

  /** Remove constant by its index in the constants array (for typed panels). */
  public async deleteConstantByActualIndex(actualIndex: number) {
    const studyId = this.getStudyId();
    if (!studyId || actualIndex < 0 || actualIndex >= this.studyConstants.length) {
      return;
    }
    
    const constantToDelete = this.studyConstants[actualIndex];
    this.studyConstants.splice(actualIndex, 1);
    this.refreshConstants();

    if (constantToDelete?.id) {
      try {
        await deleteConstant(studyId, constantToDelete.id);
      } catch (error) {
        console.error('[ConstantsDataService] Failed to delete constant from backend:', error);
      }
    }
  }

  public getConstantsOfType(type: string): Record<string, any> {
    const result: Record<string, any> = {};
    this.studyConstants.forEach((constant: any) => {
      if (constant.type === type) {
        result[constant.name] = constant;
      }
    });
    return result;
  }

  /** Rows and indices for a single constant type (name + value columns). Sorted by index (order). */
  public getRowsForType(type: string): {
    rows: { name: string; value: string; type: string; _actualIndex: number }[];
    indices: number[];
  } {
    const withType: { constant: any; actualIndex: number; orderIndex: number }[] = [];
    this.studyConstants.forEach((constant: any, actualIndex: number) => {
      if (constant.type !== type) return;
      let orderIndex = constant.index;
      if (typeof orderIndex !== 'number') {
        orderIndex = withType.length;
        constant.index = orderIndex;
      }
      withType.push({ constant, actualIndex, orderIndex });
    });
    withType.sort((a, b) => a.orderIndex - b.orderIndex);
    const rows = withType.map(({ constant, actualIndex }) => ({
      name: constant.name ?? '',
      value:
        typeof constant.value === 'string' ? constant.value : JSON.stringify(constant.value ?? ''),
      type,
      _actualIndex: actualIndex,
    }));
    const indices = withType.map((w) => w.actualIndex);
    return { rows, indices };
  }

  /** Update order indices after drag-and-drop. orderedActualIndices = new order of constants array indices. */
  public reorderConstantsOfType(type: string, orderedActualIndices: number[]): void {
    orderedActualIndices.forEach((actualIndex, newOrderIndex) => {
      if (actualIndex >= 0 && actualIndex < this.studyConstants.length && this.studyConstants[actualIndex].type === type) {
        this.studyConstants[actualIndex].index = newOrderIndex;
      }
    });
    this.refreshConstants();
  }

  public async valueChangedForType(type: string, filteredRowIndex: number, field: 'name' | 'value', newValue: any) {
    const studyId = this.getStudyId();
    if (!studyId) {
      console.error('[ConstantsDataService] Cannot update constant: no study_id available');
      return;
    }
    
    const { indices } = this.getRowsForType(type);
    const actualIndex = indices[filteredRowIndex];
    if (actualIndex == null || actualIndex < 0 || actualIndex >= this.studyConstants.length) return;
    
    const constant = this.studyConstants[actualIndex];
    
    if (field === 'value') {
      try {
        constant.value = typeof newValue === 'string' ? JSON.parse(newValue) : newValue;
      } catch {
        constant.value = newValue;
      }
    } else {
      (constant as any)[field] = newValue;
    }
    
    this.refreshConstants();

    if (constant.id) {
      try {
        const updateData: any = {};
        updateData[field] = constant[field];
        await updateConstant(studyId, constant.id, updateData);
      } catch (error) {
        console.error('[ConstantsDataService] Failed to update constant in backend:', error);
      }
    }
  }

  public async valueChanged(rowIndex: number, field: string, newValue: any) {
    const studyId = this.getStudyId();
    if (!studyId) {
      console.error('[ConstantsDataService] Cannot update constant: no study_id available');
      return;
    }
    
    if (rowIndex < 0 || rowIndex >= this.studyConstants.length) return;
    
    const constant = this.studyConstants[rowIndex];
    if (field === 'value') {
      try {
        constant.value = typeof newValue === 'string' ? JSON.parse(newValue) : newValue;
      } catch {
        constant.value = newValue;
      }
    } else {
      (constant as any)[field] = newValue;
    }
    
    this.refreshConstants();

    if (constant.id) {
      try {
        const updateData: any = {};
        updateData[field] = (constant as any)[field];
        await updateConstant(studyId, constant.id, updateData);
      } catch (error) {
        console.error('[ConstantsDataService] Failed to update constant in backend:', error);
      }
    }
  }

  public tableDataFromConstants(): TableData {
    const rows = this.studyConstants.map((constant: any) => ({
      name: constant.name,
      description: constant.description,
      type: constant.type,
      value: JSON.stringify(constant.value),
    }));

    return {
      columns: this.columns,
      rows: rows,
    };
  }

  public getTheme() {
    return themeQuartz.withParams({
      accentColor: '#FF00000',
      borderColor: 'transparent',
      browserColorScheme: 'light',
      columnBorder: true,
      headerFontSize: 14,
      headerFontWeight: 'bold',
      // headerRowBorder: false,
      cellHorizontalPadding: 10,
      headerBackgroundColor: 'var(--background-color, red)',
      // rowBorder: true,
      spacing: 8,
      wrapperBorder: false,
      backgroundColor: 'transparent',
    });
  }
}
