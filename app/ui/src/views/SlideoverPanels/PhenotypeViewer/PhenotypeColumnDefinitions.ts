import { PhenexPhenotypeCellRenderer } from './PhenotypeCellRenderers/PhenexPhenotypeCellRenderer';
import { PhenexPhenotypeCellEditor } from './PhenotypeCellRenderers/PhenexPhenotypeCellEditor';

import { PhenotypeParamCellRenderer } from './PhenotypeCellRenderers/PhenotypeParamCellRenderer';
import { max, min } from 'd3';

export const defaultColumns = [
  {
    field: 'parameter',
    headerName: '',
    sortable: true,
    width: 100,
    maxWidth: 240,
    minWidth: 200,
    pinned: 'left',
    wrapText: true,
    cellRenderer: PhenotypeParamCellRenderer,
  },
  {
    field: 'value',
    headerName: '',
    editable: true,
    flex: 1,
    minWidth: 250,
    cellEditorPopup: true,
    cellRenderer: PhenexPhenotypeCellRenderer,
    cellEditor: PhenexPhenotypeCellEditor,
    valueParser: params => params.newValue,
    valueSetter: params => {
      params.data.value = params.newValue;
      return true;
    },
    type: 'text',
  },
];
