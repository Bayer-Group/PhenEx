import React, { createContext, useContext } from 'react';

// Context includes both the value and a setter
interface ReportModeContextType {
  isReportMode: boolean;
  setReportMode: (value: boolean) => void;
}

const ReportModeContext = createContext<ReportModeContextType>({
  isReportMode: false,
  setReportMode: () => {},
});

export const useReportMode = () => useContext(ReportModeContext);

export const ReportModeProvider: React.FC<{ value: boolean; onValueChange?: (value: boolean) => void; children: React.ReactNode }> = ({ value, onValueChange, children }) => {
  return (
    <ReportModeContext.Provider value={{ isReportMode: value, setReportMode: onValueChange || (() => {}) }}>
      {children}
    </ReportModeContext.Provider>
  );
};
