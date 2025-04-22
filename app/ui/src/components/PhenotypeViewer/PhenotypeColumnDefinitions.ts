import { PhenexPhenotypeCellRenderer } from './PhenotypeCellRenderers/PhenexPhenotypeCellRenderer';
import {PhenexPhenotypeCellEditor} from './PhenotypeCellRenderers/PhenexPhenotypeCellEditor'

import { PhenotypeParamCellRenderer } from './PhenotypeCellRenderers/PhenotypeParamCellRenderer';


export const defaultColumns = [
  { 
    field: 'parameter', 
    headerName: 'Parameter', 
    sortable: true, 
    filter: true, 
    width: 80, 
    maxWidth: 150,
    wrapText: true, 
    cellRenderer: PhenotypeParamCellRenderer
  },
  {
    field: 'value',
    headerName: 'Value',
    editable: true,
    cellEditorPopup: true,
    cellRenderer: PhenexPhenotypeCellRenderer,
    cellEditor: PhenexPhenotypeCellEditor,
    valueParser: params => params.newValue,
    valueSetter: params => {
      params.data.value = params.newValue;
      return true;
    },
    type: 'text'
  },
];