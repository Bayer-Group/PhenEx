import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'phenex_three_panel_left_shown';

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

const getInitialShown = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === 'true';
  } catch {
    // ignore
  }
  return true;
};

export const ThreePanelCollapseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLeftPanelShown, setLeftPanelShown] = useState(getInitialShown);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isLeftPanelShown));
    } catch (error) {
      console.warn('Failed to save three-panel collapse state to localStorage:', error);
    }
  }, [isLeftPanelShown]);

  const toggleLeftPanel = () => setLeftPanelShown(prev => !prev);

  return (
    <ThreePanelCollapseContext.Provider
      value={{ isLeftPanelShown, setLeftPanelShown, toggleLeftPanel }}
    >
      {children}
    </ThreePanelCollapseContext.Provider>
  );
};
