import React, { createContext, useContext, useState, useCallback } from 'react';
import { RightClickMenu, RightClickMenuItem } from './RightClickMenu';

interface RightClickMenuContextValue {
  showMenu: (position: { x: number; y: number }, items: RightClickMenuItem[]) => void;
  hideMenu: () => void;
}

const RightClickMenuContext = createContext<RightClickMenuContextValue | undefined>(undefined);

/**
 * RightClickMenuProvider - Context provider for global right-click menu
 * 
 * Wrap your app or view with this provider to enable right-click menus anywhere.
 * Components can call showMenu() with their custom menu items and position.
 */
export const RightClickMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [menuState, setMenuState] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    items: RightClickMenuItem[];
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    items: [],
  });

  const showMenu = useCallback((position: { x: number; y: number }, items: RightClickMenuItem[]) => {
    setMenuState({
      visible: true,
      position,
      items,
    });
  }, []);

  const hideMenu = useCallback(() => {
    setMenuState(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <RightClickMenuContext.Provider value={{ showMenu, hideMenu }}>
      {children}
      {menuState.visible && (
        <RightClickMenu
          items={menuState.items}
          position={menuState.position}
          onClose={hideMenu}
        />
      )}
    </RightClickMenuContext.Provider>
  );
};

/**
 * useRightClickMenu - Hook to access right-click menu functionality
 * 
 * Usage:
 * ```tsx
 * const { showMenu } = useRightClickMenu();
 * 
 * const handleContextMenu = (e: React.MouseEvent) => {
 *   e.preventDefault();
 *   showMenu({ x: e.clientX, y: e.clientY }, [
 *     { label: 'Copy', onClick: () => handleCopy() },
 *     { label: 'Delete', onClick: () => handleDelete() },
 *   ]);
 * };
 * ```
 */
export const useRightClickMenu = () => {
  const context = useContext(RightClickMenuContext);
  if (!context) {
    throw new Error('useRightClickMenu must be used within RightClickMenuProvider');
  }
  return context;
};
