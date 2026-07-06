import React, { useState, useEffect, useRef } from 'react';
import styles from './ExecutePanel.module.css';
import { StudyDataService } from '../../StudyViewer/StudyDataService';
import { SlideoverPanel } from '../SlideoverPanel/SlideoverPanel';
import { TabsWithDropdown } from '../../../components/ButtonsAndTabs/Tabs/TabsWithDropdown';

export const StudyExecutePanel: React.FC = () => {
  const [dataService] = useState(() => StudyDataService.getInstance());
  const [logs, setLogs] = useState<
    Array<{ message: string | any; type: 'log' | 'error' | 'result' | 'complete'; timestamp: Date }>
  >([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    const handleExecutionProgress = (
      message: string | any,
      type: 'log' | 'error' | 'result' | 'complete'
    ) => {
      setLogs(prevLogs => [...prevLogs, { message, type, timestamp: new Date() }]);
      if (type === 'complete' || type === 'error') {
        setIsExecuting(false);
      }
    };

    dataService.addExecutionProgressListener(handleExecutionProgress);
    return () => dataService.removeExecutionProgressListener(handleExecutionProgress);
  }, [dataService]);

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const handleExecute = async () => {
    setIsExecuting(true);
    setLogs([]);
    try {
      await dataService.executeStudy();
    } catch (error) {
      console.error('Study execution failed:', error);
      setIsExecuting(false);
    }
  };

  const clearLogs = () => setLogs([]);

  const formatTimestamp = (timestamp: Date) => timestamp.toLocaleTimeString();

  const getLogClassName = (type: string, message: string | any) => {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    if (messageStr.includes('[ERROR]') || messageStr.includes('[STDERR]')) return styles.errorLog;
    if (messageStr.includes('[WARNING]') || messageStr.includes('[WARN]')) return styles.warningLog;
    if (messageStr.includes('[INFO]')) return styles.infoLog;
    if (messageStr.includes('[DEBUG]')) return styles.debugLog;
    switch (type) {
      case 'error': return styles.errorLog;
      case 'result': return styles.resultLog;
      case 'complete': return styles.completeLog;
      default: return styles.normalLog;
    }
  };

  const infoContent = () => (
    <span>
      <i>Execute all cohorts in this study.</i>
      <ul>
        <li>Each cohort is executed sequentially against the configured database</li>
        <li>Patient counts are written back to every cohort's phenotypes</li>
        <li>Results (Table 1, waterfall) are stored per cohort</li>
      </ul>
      Click <code>Execute Study</code> below to start. Execution logs are streamed in real time.
    </span>
  );

  const renderControls = () => {
    const tabs = [isExecuting ? 'Executing...' : 'Execute Study', 'Clear Logs'];
    const handleTabChange = (index: number) => {
      if (index === 0) handleExecute();
      if (index === 1) clearLogs();
    };
    return (
      <div className={styles.controls}>
        <TabsWithDropdown
          width={400}
          height={25}
          tabs={tabs}
          onTabChange={handleTabChange}
          dropdown_items={{}}
          active_tab_index={-1}
          outline_tab_index={0}
        />
      </div>
    );
  };

  const renderLogs = () => (
    <div className={styles.logsContainer} ref={logsContainerRef}>
      {logs.length === 0 ? (
        <div className={styles.emptyState} />
      ) : (
        logs.map((log, index) => {
          const displayMessage =
            typeof log.message === 'string' ? log.message : JSON.stringify(log.message, null, 2);
          return (
            <div
              key={index}
              className={`${styles.logEntry} ${getLogClassName(log.type, log.message)}`}
            >
              <span className={styles.timestamp}>[{formatTimestamp(log.timestamp)}]</span>
              <span className={styles.logMessage}>{displayMessage}</span>
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <SlideoverPanel title="Execute Study" info={infoContent()}>
      <div className={styles.container}>
        {renderControls()}
        <div className={styles.content}>{renderLogs()}</div>
      </div>
    </SlideoverPanel>
  );
};
