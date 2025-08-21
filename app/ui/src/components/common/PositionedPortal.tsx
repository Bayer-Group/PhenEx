import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PositionedPortalProps {
  children: React.ReactNode;
  triggerRef: React.RefObject<HTMLElement | null>;
  offsetX?: number;
  offsetY?: number;
  position?: 'below' | 'above' | 'right' | 'left';
  alignment?: 'left' | 'center' | 'right'; // New prop for X alignment
}

export const PositionedPortal: React.FC<PositionedPortalProps> = ({ 
  children, 
  triggerRef, 
  offsetX = 0, 
  offsetY = 0,
  position = 'below',
  alignment = 'left'
}) => {
  const [container] = useState(() => document.createElement('div'));

  useEffect(() => {
    container.style.position = 'absolute';
    container.style.zIndex = '9999';
    container.style.pointerEvents = 'none'; // Allow clicks to pass through the container
    document.body.appendChild(container);

    return () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, [container]);

  useEffect(() => {
    const updatePosition = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        
        // Calculate X position based on alignment
        let baseX = rect.left + window.scrollX;
        if (alignment === 'center') {
          baseX = rect.left + window.scrollX + (rect.width / 2);
        } else if (alignment === 'right') {
          baseX = rect.right + window.scrollX;
        }
        
        let x = baseX + offsetX;
        let y = rect.bottom + window.scrollY + offsetY;

        switch (position) {
          case 'above':
            y = rect.top + window.scrollY - offsetY;
            break;
          case 'below':
            y = rect.bottom + window.scrollY + offsetY;
            break;
          case 'right':
            x = rect.right + window.scrollX + offsetX;
            y = rect.top + window.scrollY + offsetY;
            break;
          case 'left':
            x = rect.left + window.scrollX - offsetX;
            y = rect.top + window.scrollY + offsetY;
            break;
        }

        container.style.left = `${x}px`;
        container.style.top = `${y}px`;
      }
    };

    updatePosition();

    // Update position on scroll and resize
    const handleUpdate = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [triggerRef, offsetX, offsetY, position, alignment, container]);

  // Re-enable pointer events on the portal content
  const portalContent = (
    <div style={{ pointerEvents: 'auto' }}>
      {children}
    </div>
  );

  return createPortal(portalContent, container);
};
