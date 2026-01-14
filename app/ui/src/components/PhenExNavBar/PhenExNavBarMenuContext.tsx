import React, { createContext, useContext, useState, useCallback } from 'react';

interface NavBarMenuContextType {
  openMenuId: string | null;
  openMenu: (menuId: string) => void;
  closeMenu: (menuId: string) => void;
  isMenuOpen: (menuId: string) => boolean;
}

const NavBarMenuContext = createContext<NavBarMenuContextType | undefined>(undefined);

export const NavBarMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const openMenu = useCallback((menuId: string) => {
    setOpenMenuId(menuId);
  }, []);

  const closeMenu = useCallback((menuId: string) => {
    setOpenMenuId(prev => prev === menuId ? null : prev);
  }, []);

  const isMenuOpen = useCallback((menuId: string) => {
    return openMenuId === menuId;
  }, [openMenuId]);

  return (
    <NavBarMenuContext.Provider value={{ openMenuId, openMenu, closeMenu, isMenuOpen }}>
      {children}
    </NavBarMenuContext.Provider>
  );
};

export const useNavBarMenu = (menuId: string) => {
  const context = useContext(NavBarMenuContext);
  if (!context) {
    throw new Error('useNavBarMenu must be used within NavBarMenuProvider');
  }

  const { openMenu, closeMenu, isMenuOpen } = context;

  return {
    isOpen: isMenuOpen(menuId),
    open: () => openMenu(menuId),
    close: () => closeMenu(menuId),
  };
};
