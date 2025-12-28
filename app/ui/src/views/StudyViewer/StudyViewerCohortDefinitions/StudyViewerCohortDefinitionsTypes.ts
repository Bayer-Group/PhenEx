import { TableData, ColumnDefinition } from '../../CohortViewer/tableTypes';
import TypeCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/TypeCellRenderer';
import NameCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/NameCellRenderer';
import DescriptionCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/DescriptionCellRenderer';
import PhenotypeCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/PhenotypeCellRenderer';
import DomainCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/DomainCellRenderer';
import CodelistCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/CodelistCellRenderer';
import RowDragCellRenderer from '../../CohortViewer/CohortTable/CellRenderers/RowDragCellRenderer';

export interface CohortWithTableData {
  cohort: Record<string, any>;
  table_data: TableData;
}

export const cohortDefinitionColumns: ColumnDefinition[] = [
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
    cellRenderer: RowDragCellRenderer,
  },
  {
    field: 'type',
    headerName: 'Type',
    width: 0,
    editable: false,
    resizable: false,
    filter: false,
    cellRenderer: TypeCellRenderer,
  },
  {
    field: 'name',
    headerName: 'Name',
    flex: 1,
    editable: false,
    resizable: false,
    filter: false,
    cellRenderer: NameCellRenderer,
  }
];