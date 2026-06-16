import React from 'react';
import ReactDOM from 'react-dom';
import { RightClickMenu, RightClickMenuItem } from './RightClickMenu';

export interface ScaledRightClickMenuProps {
  items: RightClickMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
  zoomScale?: number;
}

/**
 * ScaledRightClickMenu - Wrapper for RightClickMenu that handles coordinate transformation
 * for zoomed/scaled containers.
 * 
 * When a right-click event occurs inside a scaled container, the clientX/clientY coordinates
 * are in viewport space. This component renders the menu in a portal at document.body level
 * to ensure it's not affected by parent transforms, using the raw mouse coordinates.
 */
export const ScaledRightClickMenu: React.FC<ScaledRightClickMenuProps> = ({
  items,
  position,
  onClose,
  zoomScale = 1,
}) => {
  // For menus rendered outside scaled containers (in portal at body level),
  // we use the raw mouse coordinates directly since the menu itself is not scaled
  const adjustedPosition = {
    x: position.x,
    y: position.y
  };

  // Render in portal at document body to avoid being affected by parent transforms
  return ReactDOM.createPortal(
    <RightClickMenu
      items={items}
      position={adjustedPosition}
      onClose={onClose}
    />,
    document.body
  );
};
