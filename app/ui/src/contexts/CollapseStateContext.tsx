import React, { createContext, useContext, useState } from 'react';

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

export const CollapseStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapseState, setCollapseState] = useState<CollapseState>(CollapseState.AllOpen);

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
