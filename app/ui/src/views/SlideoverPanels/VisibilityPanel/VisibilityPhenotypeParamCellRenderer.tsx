import { ICellRendererParams } from 'ag-grid-community';
import { PhenotypeParamCellRenderer } from '../PhenotypeViewer/PhenotypeCellRenderers/PhenotypeParamCellRenderer';

/**
 * Adapter component to use PhenotypeParamCellRenderer in the VisibilityPanel context
 * Maps the 'column' field to 'parameter' expected by PhenotypeParamCellRenderer
 */
export const VisibilityPhenotypeParamCellRenderer = (props: ICellRendererParams) => {
  // Create adapted data object with 'parameter' field that PhenotypeParamCellRenderer expects
  const adaptedData = {
    ...props.data,
    parameter: props.data.column // Map column to parameter
  };

  // Pass the adapted data to the PhenotypeParamCellRenderer
  return PhenotypeParamCellRenderer({...props, data: adaptedData});
};

export default VisibilityPhenotypeParamCellRenderer;