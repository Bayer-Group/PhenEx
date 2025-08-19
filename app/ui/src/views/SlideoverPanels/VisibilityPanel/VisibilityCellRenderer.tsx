import React from 'react';
import { ICellRendererParams } from 'ag-grid-community';
import EyeSolidIcon from '../../../assets/icons/eye-solid.svg';
import EyeClosedIcon from '../../../assets/icons/eye-closed.svg';

interface VisibilityCellRendererProps extends ICellRendererParams {
  value: boolean;
  data: {
    column: string;
    visible: boolean;
  };
}

export const VisibilityCellRenderer: React.FC<VisibilityCellRendererProps> = (props) => {
  const { value, data, api, node } = props;
  const isVisible = value;

  const handleClick = () => {
    // Toggle the visibility value
    const newValue = !isVisible;
    
    // Update the node data
    data.visible = newValue;
    
    // Trigger the cell value changed event
    if (api && node) {
      api.refreshCells({ 
        rowNodes: [node], 
        force: true 
      });
      
      // Create a synthetic event to trigger onCellValueChanged
      const event = {
        newValue: newValue,
        oldValue: isVisible,
        data: data,
        colDef: { field: 'visible' },
        node: node,
        api: api
      };
      
      // Try to get the onCellValueChanged callback from the grid context
      const gridOptions = api.getGridOption('onCellValueChanged');
      if (typeof gridOptions === 'function') {
        // Cast to any to avoid type issues with the synthetic event
        (gridOptions as any)(event);
      }
    }
  };

  return (
    <div 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100%',
        cursor: 'pointer',
        width: '100%'
      }}
      onClick={handleClick}
      title={isVisible ? 'Click to hide column' : 'Click to show column'}
    >
      {isVisible ? (
        <img 
          src={EyeSolidIcon}
          alt="Visible"
          style={{ 
            width: '16px', 
            height: '16px',
            filter: 'brightness(0) saturate(100%) invert(27%) sepia(82%) saturate(2526%) hue-rotate(200deg) brightness(97%) contrast(102%)' // Blue color
          }} 
        />
      ) : (
        <img 
          src={EyeClosedIcon}
          alt="Hidden"
          style={{ 
            width: '16px', 
            height: '16px',
            filter: 'brightness(0) saturate(100%) invert(60%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(106%) contrast(92%)' // Gray color
          }} 
        />
      )}
    </div>
  );
};
