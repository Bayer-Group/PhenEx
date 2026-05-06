import { FC, useState, useRef } from 'react';
import navBarStyles from '../../../components/PhenExNavBar/NavBar.module.css';
import { Tabs } from '../../../components/ButtonsAndTabs/Tabs/Tabs';
import { PhenExNavBarMenu } from '../../../components/PhenExNavBar/PhenExNavBarMenu';
import { SwitchButton } from '../../../components/ButtonsAndTabs/SwitchButton/SwitchButton';

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
  showAnalysis,
  onShowAnalysisChange,
  showLabels,
  onShowLabelsChange,
}) => {
  const [isVisMenuOpen, setIsVisMenuOpen] = useState(false);
  const eyeBtnRef = useRef<HTMLButtonElement>(null);
  const visMenuRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

  const handleTabChange = (index: number) => {
    const key = TAB_KEYS[index];
    if (tabAvail[key]) onTabChange(key);
  };

  return (
    <>
      <div className={navBarStyles.navBar} style={{ height: 44 }}>
        <div className={navBarStyles.viewNavContent}>
          <Tabs
            tabs={TAB_LABELS}
            active_tab_index={TAB_KEYS.indexOf(activeTab)}
            onTabChange={handleTabChange}
            classNameTabs={navBarStyles.classNameSectionTabs}
            classNameTabsContainer={navBarStyles.classNameTabsContainer}
            classNameActiveTab={navBarStyles.classNameActiveTab}
            classNameHoverTab={navBarStyles.classNameHoverTab}
          />
          <button
            ref={eyeBtnRef}
            className={navBarStyles.eyeButton}
            onMouseEnter={() => setIsVisMenuOpen(true)}
            onMouseLeave={() => {
              setTimeout(() => {
                if (!visMenuRef.current?.matches(':hover')) {
                  setIsVisMenuOpen(false);
                }
              }, 100);
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </div>

      <PhenExNavBarMenu
        isOpen={isVisMenuOpen}
        onClose={() => setIsVisMenuOpen(false)}
        anchorElement={eyeBtnRef.current}
        menuRef={visMenuRef}
        onMouseEnter={() => setIsVisMenuOpen(true)}
        onMouseLeave={() => setIsVisMenuOpen(false)}
        verticalPosition="above"
        horizontalAlignment="center"
      >
        <div style={{ padding: '12px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>Visibility Options</div>
          <SwitchButton
            label="Show Analysis"
            value={showAnalysis}
            onValueChange={onShowAnalysisChange}
          />
          <SwitchButton
            label="Show Labels"
            value={showLabels}
            onValueChange={onShowLabelsChange}
          />
        </div>
      </PhenExNavBarMenu>
    </>
  );
};
