import { FC } from 'react';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';
import navBarStyles from '../../../components/PhenExNavBar/NavBar.module.css';

type TabKey = 'boolean' | 'categorical' | 'numeric';

const TAB_KEYS: TabKey[] = ['boolean', 'categorical', 'numeric'];
const TAB_LABELS = ['Boolean', 'Categorical', 'Numeric'];

interface ReportDataTypeSelectorProps {
  activeTab: TabKey;
  tabAvail: Record<TabKey, boolean>;
  onTabChange: (tab: TabKey) => void;
  showAnalysis: boolean;
  onShowAnalysisChange: (value: boolean) => void;
  showLabels: boolean;
  onShowLabelsChange: (value: boolean) => void;
}

export const ReportDataTypeSelector: FC<ReportDataTypeSelectorProps> = ({
  activeTab,
  tabAvail,
  onTabChange,
}) => {
  const handleTabChange = (index: number) => {
    const key = TAB_KEYS[index];
    if (tabAvail[key]) onTabChange(key);
  };

  return (
    <Tabs
      tabs={TAB_LABELS}
      active_tab_index={TAB_KEYS.indexOf(activeTab)}
      onTabChange={handleTabChange}
      classNameTabs={navBarStyles.classNameSectionTabs}
      classNameTabsContainer={navBarStyles.classNameTabsContainer}
      classNameActiveTab={navBarStyles.classNameActiveTab}
      classNameHoverTab={navBarStyles.classNameHoverTab}
      width="100%"
    />
  );
};
