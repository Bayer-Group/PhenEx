import React, { useState, useEffect } from 'react';
import { ICellEditorParams } from '@ag-grid-community/core';
import styles from './TabbedCellEditor.module.css';

export interface TabbedCellEditorProps extends ICellEditorParams {
  options?: string[];
  value?: any;
}

export interface TabConfig {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabbedCellEditorComponentProps extends TabbedCellEditorProps {
  tabs: TabConfig[];
}

export const TabbedCellEditor = (props: TabbedCellEditorComponentProps) => {
  const { tabs, value, api, column, node } = props;
  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || '');
  const [currentValue, setCurrentValue] = useState(value);

  useEffect(() => {
    if (value !== undefined && JSON.stringify(value) !== JSON.stringify(currentValue)) {
      setCurrentValue(value);
    }
  }, [value]);

  // useEffect(() => {
  //   console.log("Value changed", currentValue)
  //   if (props.onValueChange && currentValue !== undefined && JSON.stringify(currentValue) !== JSON.stringify(value)) {
  //     props.onValueChange(currentValue);
  //   }
  // }, [currentValue]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
  };

  const handleValueChange = (newValue: any) => {
    setCurrentValue(newValue);
    if (props.onValueChange) {
      props.onValueChange(newValue);
    }
  };

  return (
    <div className={styles.editor} tabIndex={0}>
      <div className={styles.tabList}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTab : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className={styles.tabContent}>
        {React.cloneElement(tabs.find(tab => tab.id === activeTab)?.content as React.ReactElement, {
          value: currentValue,
          api,
          column,
          node,
        })}
      </div>
    </div>
  );
};

TabbedCellEditor.displayName = 'TabbedCellEditor';
