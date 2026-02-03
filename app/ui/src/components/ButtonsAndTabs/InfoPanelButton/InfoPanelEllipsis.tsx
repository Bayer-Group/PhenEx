import React from 'react';
import { InfoPanelButton } from './InfoPanelButton';

const ellipsisSvg = (
  <svg
    width="25"
    height="25"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="6" cy="12" r="1" fill="currentColor" />
    <circle cx="18" cy="12" r="1" fill="currentColor" />
  </svg>
);

interface InfoPanelEllipsisProps {
  tooltipText: string;
  onClick: () => void;
}

export const InfoPanelEllipsis: React.FC<InfoPanelEllipsisProps> = ({
  tooltipText,
  onClick,
}) => {
  return <InfoPanelButton tooltipText={tooltipText} onClick={onClick} svg={ellipsisSvg} />;
};
