import React, { createContext, useContext, useState, useEffect } from 'react';

const DEFAULT_STORAGE_KEY = 'phenex_three_panel_left_shown';

interface ThreePanelCollapseContextType {
  /** True = left panel shown, false = hidden */
  isLeftPanelShown: boolean;
  setLeftPanelShown: (shown: boolean) => void;
  toggleLeftPanel: () => void;
}

const ThreePanelCollapseContext = createContext<ThreePanelCollapseContextType>({
  isLeftPanelShown: true,
  setLeftPanelShown: () => {},
  toggleLeftPanel: () => {},
});

export const useThreePanelCollapse = () => useContext(ThreePanelCollapseContext);

const getInitialShown = (key: string): boolean => {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored === 'true';
  } catch {
    // ignore
  }
  return true;
};

interface ThreePanelCollapseProviderProps {
  children: React.ReactNode;
  storageKey?: string;
}

export const ThreePanelCollapseProvider: React.FC<ThreePanelCollapseProviderProps> = ({ children, storageKey = DEFAULT_STORAGE_KEY }) => {
  const [isLeftPanelShown, setLeftPanelShown] = useState(() => getInitialShown(storageKey));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(isLeftPanelShown));
    } catch (error) {
      console.warn('Failed to save three-panel collapse state to localStorage:', error);
    }
  }, [isLeftPanelShown, storageKey]);

  const toggleLeftPanel = () => setLeftPanelShown(prev => !prev);

  return (
    <ThreePanelCollapseContext.Provider
      value={{ isLeftPanelShown, setLeftPanelShown, toggleLeftPanel }}
    >
      {children}
    </ThreePanelCollapseContext.Provider>
  );
};
