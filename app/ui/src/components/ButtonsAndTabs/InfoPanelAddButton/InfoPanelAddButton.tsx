import React from 'react';
import { InfoPanelButton } from '../InfoPanelButton';

const addSvg = (
  <svg
    width="25"
    height="25"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

interface InfoPanelAddButtonProps {
  tooltipText: string;
  onClick: () => void;
}

export const InfoPanelAddButton: React.FC<InfoPanelAddButtonProps> = ({
  tooltipText,
  onClick,
}) => {
  return <InfoPanelButton tooltipText={tooltipText} onClick={onClick} svg={addSvg} />;
};
