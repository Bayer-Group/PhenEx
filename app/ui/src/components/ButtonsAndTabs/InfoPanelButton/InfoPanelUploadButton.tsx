import React, { useRef } from 'react';
import { InfoPanelButton } from './InfoPanelButton';

const uploadSvg = (
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

interface InfoPanelUploadButtonProps {
  tooltipText: string;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  multiple?: boolean;
}

export const InfoPanelUploadButton: React.FC<InfoPanelUploadButtonProps> = ({
  tooltipText,
  onFileSelect,
  accept = '.csv',
  multiple = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <InfoPanelButton tooltipText={tooltipText} onClick={handleClick} svg={uploadSvg} />
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onFileSelect}
        style={{ display: 'none' }}
      />
    </>
  );
};
