import React from 'react';

interface ArrowUpRightIconProps {
  className?: string;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  strokeWidth?: number;
  color?: string;
  size?: number;
}

const ArrowUpRightIcon: React.FC<ArrowUpRightIconProps> = ({
  className,
  onClick,
  strokeWidth = 3,
  color = 'currentColor',
  size = 20,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    onClick={onClick}
    aria-hidden="true"
  >
    <path
      d="M14 34L34 14M34 14H14M34 14V34"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default ArrowUpRightIcon;
