import React from 'react';
import { ICellRendererParams } from '@ag-grid-community/core';
import { InfoPanelButton } from '../../../components/ButtonsAndTabs/InfoPanelButton/InfoPanelButton';

const minusSvg = (
  <svg
    width="25"
    height="25"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1"
    strokeLinecap="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

interface InfoPanelDeleteCellRendererParams extends ICellRendererParams {
  onDelete?: (data: any) => void;
}

export const InfoPanelDeleteCellRenderer: React.FC<InfoPanelDeleteCellRendererParams> = (params) => {
  const onDelete = params.colDef?.cellRendererParams?.onDelete;
  const handleClick = () => {
    if (onDelete && params.data) {
      onDelete(params.data);
    }
  };

  return (
    <div style={{marginLeft: 2, marginTop: 2}}>
    <InfoPanelButton
      tooltipText="Delete"
      onClick={handleClick}
      svg={minusSvg}
    />
    </div>
  );
};

export default InfoPanelDeleteCellRenderer;
