import React, { createContext, useContext, useState, useEffect } from 'react';

const COLLAPSE_STATE_KEY = 'phenex_collapse_state';

export enum CollapseState {
  AllOpen = 'allopen',
  Hide1 = 'hide_1',
  Hide2 = 'hide_2',
}

interface CollapseStateContextType {
  collapseState: CollapseState;
  cycleCollapseState: () => void;
}

const CollapseStateContext = createContext<CollapseStateContextType>({
  collapseState: CollapseState.AllOpen,
  cycleCollapseState: () => {},
});

export const useCollapseState = () => useContext(CollapseStateContext);

const getInitialCollapseState = (): CollapseState => {
  try {
    const stored = localStorage.getItem(COLLAPSE_STATE_KEY);
    if (stored && Object.values(CollapseState).includes(stored as CollapseState)) {
      return stored as CollapseState;
    }
  } catch (error) {
    console.warn('Failed to read collapse state from localStorage:', error);
  }
  return CollapseState.AllOpen;
};

export const CollapseStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapseState, setCollapseState] = useState<CollapseState>(getInitialCollapseState);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STATE_KEY, collapseState);
    } catch (error) {
      console.warn('Failed to save collapse state to localStorage:', error);
    }
  }, [collapseState]);

  const cycleCollapseState = () => {
    setCollapseState((current) => {
      switch (current) {
        case CollapseState.AllOpen:
          return CollapseState.Hide1;
        case CollapseState.Hide1:
          return CollapseState.Hide2;
        case CollapseState.Hide2:
          return CollapseState.AllOpen;
        default:
          return CollapseState.AllOpen;
      }
    });
  };

  return (
    <CollapseStateContext.Provider value={{ collapseState, cycleCollapseState }}>
      {children}
    </CollapseStateContext.Provider>
  );
};
