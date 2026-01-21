import React, { createContext, useContext } from 'react';

// Default to false (not in report mode)
const ReportModeContext = createContext<boolean>(false);

export const useReportMode = () => useContext(ReportModeContext);

export const ReportModeProvider: React.FC<{ value: boolean; children: React.ReactNode }> = ({ value, children }) => {
  return <ReportModeContext.Provider value={value}>{children}</ReportModeContext.Provider>;
};
