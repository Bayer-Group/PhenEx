import { TableData, ColumnDefinition } from '../../CohortViewer/tableTypes';
import TypeCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/TypeCellRenderer';
import NameCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/NameCellRenderer';
import RowDragCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/RowDragCellRenderer';
import SelectionCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/SelectionCellRenderer';

export interface CohortWithTableData {
  cohort: Record<string, any>;
  table_data: TableData;
}

// AG Grid component registration map
// Returns object instead of exporting directly to avoid circular dependency issues
export const getStudyViewerCellRenderers = () => ({
  typeCellRenderer: TypeCellRenderer,
  nameCellRenderer: NameCellRenderer,
  rowDragCellRenderer: RowDragCellRenderer,
  selectionCellRenderer: SelectionCellRenderer,
});

export const cohortDefinitionColumns: ColumnDefinition[] = [
  {
    field: 'selection',
    headerName: '',
    width: 5,
    pinned: 'left',
    resizable: false,
    filter: false,
    suppressHeaderMenuButton: true,
    cellRenderer: 'selectionCellRenderer',
  },
  {
    field: 'rowDrag',
    headerName: '',
    width: 30,
    pinned: 'left',
    rowDrag: true,
    resizable: false,
    filter: false,
    suppressHeaderMenuButton: true,
    cellClass: 'row-drag-handle',
    cellRenderer: 'rowDragCellRenderer',
  },
  {
    field: 'type',
    headerName: 'Type',
    width: 40,
    editable: false,
    resizable: false,
    filter: false,
    cellRenderer: 'typeCellRenderer',
  },
  {
    field: 'name',
    headerName: 'Name',
    flex: 1,
    editable: true,
    resizable: false,
    filter: false,
    cellRenderer: 'nameCellRenderer',
    cellEditor: 'agTextCellEditor',
  }
];